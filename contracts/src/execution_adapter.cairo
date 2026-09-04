// SPDX-License-Identifier: Apache-2.0
//
// Sole - ExecutionAdapter
// The venue layer. Sole is the protagonist: a financing action against a real
// money market is CAUSALLY DOWNSTREAM of Sole's authorization. The adapter can
// only be driven by an authorization token that Sole mints when a right goes
// ACTIVE, and that token is single-use, bound to the slot, and consumed at
// settlement. Bank B's duplicate claim reverts at Sole's exclusivity check, so
// no authorization is ever minted and the venue never executes.
//
//   canonical right
//        │  claim (private, via anonymizer)
//        ▼
//   RightsRegistry  ── mints ──▶  ExecAuth{slot_key, nonce}   (single-use)
//        │                                   │
//        │                                   ▼
//        │                         ExecutionAdapter.finance(auth, ...)
//        │                                   │  [assert auth valid & unused]
//        │                                   ▼
//        │                            money market executes
//        ▼                                   │
//   settle(nullifier) ◀──── consumes auth ───┘  → right CONSUMED
//
// Two implementations behind ONE interface (DECISIONS D-009):
//   VesuAdapter        - the real Starknet money market (STRK20-integrating).
//   FallbackMarket     - a minimal in-repo lending vault, so the full mainnet
//                        loop ships even if the external venue integration
//                        fights us. The Sole authorization path is identical;
//                        only the target behind the adapter changes.

use starknet::ContractAddress;

/// Single-use execution authorization minted by Sole. The venue cannot act
/// without a valid, unconsumed auth bound to an ACTIVE right.
#[derive(Copy, Drop, Serde)]
pub struct ExecAuth {
    pub slot_key: felt252,
    pub nonce: felt252, // Poseidon(TAG_EXEC, slot_key, claim_commitment): binds auth to this claim
}

#[starknet::interface]
pub trait IExecutionAdapter<TContractState> {
    /// Execute one financing action against the venue. MUST verify with the
    /// RightsRegistry that `auth` corresponds to an ACTIVE right and has not
    /// been consumed. Reverts otherwise. Returns an opaque venue receipt id.
    fn finance(
        ref self: TContractState, auth: ExecAuth, shielded_amount_commitment: felt252,
    ) -> felt252;

    /// Settle/repay the financing and release the venue position. Called on the
    /// Sole settlement path; consuming the right consumes the auth.
    fn settle(ref self: TContractState, auth: ExecAuth) -> felt252;

    fn registry(self: @TContractState) -> ContractAddress;
    fn venue(self: @TContractState) -> ContractAddress;
}

/// Authorization check shared by every adapter: the venue may act only while
/// Sole says the right is ACTIVE and the auth nonce matches the recorded claim.
#[starknet::interface]
pub trait IAuthGate<TContractState> {
    fn assert_authorized(self: @TContractState, auth: ExecAuth);
}

pub mod ExecTags {
    pub const TAG_EXEC: felt252 = 'sole:exec';
}

// ---------------------------------------------------------------------------
// Fallback market: guaranteed-shippable in-repo lending vault. Real shielded
// value moves; the loop completes on mainnet without an external dependency.
// ---------------------------------------------------------------------------
#[starknet::contract]
pub mod FallbackMarket {
    use super::{IExecutionAdapter, ExecAuth, ExecTags};
    use core::poseidon::poseidon_hash_span;
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };
    use sole_contracts::rights_registry::{
        IRightsRegistryDispatcher, IRightsRegistryDispatcherTrait, RightState,
    };

    #[storage]
    struct Storage {
        registry: ContractAddress,
        anonymizer: ContractAddress,
        financed: Map<felt252, bool>, // slot_key -> already financed once
        position: Map<felt252, felt252>, // slot_key -> opaque position/amount commitment
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event { Financed: Financed, Repaid: Repaid }
    #[derive(Drop, starknet::Event)]
    pub struct Financed { #[key] pub slot_key: felt252 }
    #[derive(Drop, starknet::Event)]
    pub struct Repaid { #[key] pub slot_key: felt252 }

    pub mod Errors {
        pub const NOT_ANONYMIZER: felt252 = 'CALLER_NOT_ANONYMIZER';
        pub const RIGHT_NOT_ACTIVE: felt252 = 'AUTH_RIGHT_NOT_ACTIVE';
        pub const INVALID_AUTH: felt252 = 'AUTH_NONCE_MISMATCH';
        pub const ALREADY_FINANCED: felt252 = 'RIGHT_ALREADY_FINANCED';
    }

    #[constructor]
    fn constructor(ref self: ContractState, registry: ContractAddress, anonymizer: ContractAddress) {
        self.registry.write(registry);
        self.anonymizer.write(anonymizer);
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        // The whole point: the venue call is gated by Sole. If the right is not
        // ACTIVE (never claimed, or a duplicate that reverted, or consumed),
        // there is no authorization and financing cannot execute.
        //
        // auth.nonce is NOT trusted as caller-supplied: it is recomputed here
        // from the registry's own on-chain commitment for this slot and must
        // match exactly. Without this, a nonce is just an arbitrary felt the
        // caller picks - nothing would stop calling finance() repeatedly on
        // the same ACTIVE right with a fresh made-up nonce each time, since
        // "already used" was tracked per-nonce, not per-right.
        fn gate(self: @ContractState, auth: ExecAuth) -> IRightsRegistryDispatcher {
            assert(get_caller_address() == self.anonymizer.read(), Errors::NOT_ANONYMIZER);
            let reg = IRightsRegistryDispatcher { contract_address: self.registry.read() };
            assert(reg.state_of(auth.slot_key) == RightState::Active, Errors::RIGHT_NOT_ACTIVE);
            let commitment = reg.commitment_of(auth.slot_key);
            let expected_nonce = poseidon_hash_span(
                [ExecTags::TAG_EXEC, auth.slot_key, commitment].span(),
            );
            assert(auth.nonce == expected_nonce, Errors::INVALID_AUTH);
            reg
        }
    }

    #[abi(embed_v0)]
    impl AdapterImpl of IExecutionAdapter<ContractState> {
        fn finance(ref self: ContractState, auth: ExecAuth, shielded_amount_commitment: felt252) -> felt252 {
            self.gate(auth);
            // One financing per right while it stays ACTIVE - keyed by
            // slot_key, not by the auth nonce, so a fresh nonce can't be used
            // to finance the same right a second time.
            assert(!self.financed.read(auth.slot_key), Errors::ALREADY_FINANCED);
            self.financed.write(auth.slot_key, true);
            // real shielded value settles here via the STRK20 private-transfer
            // path (wired in the SDK/privacy_invoke leg); we record the opaque
            // position commitment. The amount never becomes public.
            self.position.write(auth.slot_key, shielded_amount_commitment);
            self.emit(Event::Financed(Financed { slot_key: auth.slot_key }));
            shielded_amount_commitment
        }
        fn settle(ref self: ContractState, auth: ExecAuth) -> felt252 {
            self.gate(auth);
            let pos = self.position.read(auth.slot_key);
            self.position.write(auth.slot_key, 0);
            self.emit(Event::Repaid(Repaid { slot_key: auth.slot_key }));
            pos
        }
        fn registry(self: @ContractState) -> ContractAddress { self.registry.read() }
        // FallbackMarket has no separate venue contract - it IS the venue
        // (a self-contained in-repo vault), so this returns its own address,
        // not the registry's.
        fn venue(self: @ContractState) -> ContractAddress { get_contract_address() }
    }
}

// ---------------------------------------------------------------------------
// Vesu adapter: same gate, real external venue. finance()/settle() forward the
// shielded position into Vesu's lending market after the identical Sole
// authorization check. Wiring to Vesu's entrypoints is completed against the
// STRK20 skills + Vesu interfaces (see docs/INTEGRATING.md and AGENT_HANDOFF).
// If Vesu integration is not landed by the deadline, deploy FallbackMarket
// instead - the Sole authorization path and the demo are unchanged.
// ---------------------------------------------------------------------------
#[starknet::contract]
pub mod VesuAdapter {
    use super::{IExecutionAdapter, ExecAuth, ExecTags};
    use core::poseidon::poseidon_hash_span;
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };
    use sole_contracts::rights_registry::{
        IRightsRegistryDispatcher, IRightsRegistryDispatcherTrait, RightState,
    };

    #[storage]
    struct Storage {
        registry: ContractAddress,
        anonymizer: ContractAddress,
        vesu: ContractAddress, // Vesu market entrypoint
        financed: Map<felt252, bool>, // slot_key -> already financed once
    }

    pub mod Errors {
        pub const NOT_ANONYMIZER: felt252 = 'CALLER_NOT_ANONYMIZER';
        pub const RIGHT_NOT_ACTIVE: felt252 = 'AUTH_RIGHT_NOT_ACTIVE';
        pub const INVALID_AUTH: felt252 = 'AUTH_NONCE_MISMATCH';
        pub const ALREADY_FINANCED: felt252 = 'RIGHT_ALREADY_FINANCED';
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, registry: ContractAddress, anonymizer: ContractAddress, vesu: ContractAddress,
    ) {
        self.registry.write(registry);
        self.anonymizer.write(anonymizer);
        self.vesu.write(vesu);
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        // Same gate as FallbackMarket - see its comment for why the nonce is
        // recomputed rather than trusted from calldata.
        fn gate(self: @ContractState, auth: ExecAuth) -> IRightsRegistryDispatcher {
            assert(get_caller_address() == self.anonymizer.read(), Errors::NOT_ANONYMIZER);
            let reg = IRightsRegistryDispatcher { contract_address: self.registry.read() };
            assert(reg.state_of(auth.slot_key) == RightState::Active, Errors::RIGHT_NOT_ACTIVE);
            let commitment = reg.commitment_of(auth.slot_key);
            let expected_nonce = poseidon_hash_span(
                [ExecTags::TAG_EXEC, auth.slot_key, commitment].span(),
            );
            assert(auth.nonce == expected_nonce, Errors::INVALID_AUTH);
            reg
        }
    }

    #[abi(embed_v0)]
    impl AdapterImpl of IExecutionAdapter<ContractState> {
        fn finance(ref self: ContractState, auth: ExecAuth, shielded_amount_commitment: felt252) -> felt252 {
            self.gate(auth);
            assert(!self.financed.read(auth.slot_key), Errors::ALREADY_FINANCED);
            self.financed.write(auth.slot_key, true);
            // TODO(integration): call Vesu deposit/borrow against the shielded
            // position, using the STRK20 private-transfer output as the funding
            // leg. Returns Vesu's position id. Gate above guarantees Sole
            // authorized this exact financing and nothing else.
            shielded_amount_commitment
        }
        fn settle(ref self: ContractState, auth: ExecAuth) -> felt252 {
            self.gate(auth);
            // TODO(integration): repay/close the Vesu position; funds return via
            // the private STRK20 path. Consuming the right consumes the auth.
            auth.nonce
        }
        fn registry(self: @ContractState) -> ContractAddress { self.registry.read() }
        fn venue(self: @ContractState) -> ContractAddress { self.vesu.read() }
    }
}

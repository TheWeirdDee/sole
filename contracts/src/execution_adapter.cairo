// SPDX-License-Identifier: Apache-2.0
//
// Sole - ExecutionAdapter
// The adapter gate. An adapter action is causally downstream of Sole's
// authorization: it can run only with an authorization derived from an ACTIVE
// right, bound to the slot, and invalid once that right is consumed. A duplicate
// claim produces no valid authorization, so the adapter cannot record a second
// position for that claim.
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
//        │                            adapter records a position
//        ▼                                   │
//   settle(nullifier) ◀──── consumes auth ───┘  → right CONSUMED
//
// The deployed FallbackMarket implementation below records an opaque position
// commitment and does not transfer assets.

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
    /// Record one adapter action. MUST verify with the RightsRegistry that
    /// `auth` corresponds to an ACTIVE right and has not been consumed. Reverts
    /// otherwise. Returns an opaque position id.
    fn finance(
        ref self: TContractState, auth: ExecAuth, shielded_amount_commitment: felt252,
    ) -> felt252;

    /// Clear the adapter position. Called on the Sole consumption path;
    /// consuming the right invalidates the auth.
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
// Fallback adapter: in-repo position bookkeeping. It records and clears an
// opaque commitment only; it does not lend, repay, transfer tokens, or call an
// external market.
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
            // The adapter call is gated by Sole. If the right is not ACTIVE
            // (never claimed, duplicate, or consumed), no position can be
            // recorded.
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
            // This implementation records the opaque position commitment only.
            // It deliberately performs no asset transfer or external call.
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
        // FallbackMarket is its own adapter endpoint, so source deployments
        // return this contract address. Each deployment must be read back and
        // verified before it is described as an independent venue.
        fn venue(self: @ContractState) -> ContractAddress { get_contract_address() }
    }
}

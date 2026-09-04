// SPDX-License-Identifier: Apache-2.0
//
// Sole - RightsRegistry
// The exclusivity state machine. One canonical right, one active claimant,
// one consumption. The registry is deliberately ignorant of what a "right"
// represents (an invoice, a receivable, a licence): it only enforces the
// exclusivity invariant over a commitment.
//
// INVARIANT (also stated in README.md and docs/STATE_MACHINE.md):
//   for every slot_key:
//       state in {UNCLAIMED, ACTIVE, CONSUMED}
//       state == ACTIVE   => exactly one valid claim commitment is recorded
//       state == CONSUMED => no new claim may become ACTIVE
//   and:
//       claimant identity  not in public registry state
//       claim amount       not in public registry state
//       counterparty       not in public registry state
//   The public chain only exposes:  slot_key -> state -> commitment

use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, PartialEq, starknet::Store)]
pub enum RightState {
    #[default]
    Unclaimed,
    Active,
    Consumed,
}

#[starknet::interface]
pub trait IRightsRegistry<TContractState> {
    /// One-time wiring to the ClaimAnonymizer, callable only by whoever
    /// deployed this registry. Exists because RightsRegistry and
    /// ClaimAnonymizer each need the other's address in their constructor -
    /// a cycle no address precomputation can resolve (each address's
    /// computation would need the other as an input). The deployer deploys
    /// this registry first, then the anonymizer with the registry's now-real
    /// address, then calls this once. Reverts on a second call, so the
    /// window in which the registry has no anonymizer is the only window
    /// this can be set - after that it is exactly as immutable as if it had
    /// been a constructor argument.
    fn initialize_anonymizer(ref self: TContractState, anonymizer: ContractAddress);

    /// Register a canonical right. Idempotent per slot_key at the UNCLAIMED
    /// boundary: the first registration wins; a second registration of a
    /// slot that already exists reverts. `slot_key` is derived off-chain as
    /// Poseidon(TAG_SLOT, canonical_asset_id) and is intentionally
    /// deterministic so any party can compute it and collide.
    fn register_right(ref self: TContractState, slot_key: felt252);

    /// Acquire the exclusive claim. `claim_commitment` is the private
    /// ownership record Poseidon(TAG_CLAIM, slot_key, claimant_secret,
    /// funding_note); the registry never learns its pre-image. Reverts with
    /// 'RIGHT_ALREADY_ACTIVE' if the slot is already claimed - this revert is
    /// the demonstrated invariant.
    fn claim(ref self: TContractState, slot_key: felt252, claim_commitment: felt252);

    /// Consume the right. `nullifier` is Poseidon(TAG_NULL, claimant_secret,
    /// slot_key): producing it requires the claimant secret, so only the
    /// holder can settle. Marks the slot CONSUMED and burns the nullifier so
    /// settlement cannot be replayed.
    fn settle(ref self: TContractState, slot_key: felt252, nullifier: felt252);

    // --- views (public projection only) ---
    fn state_of(self: @TContractState, slot_key: felt252) -> RightState;
    fn commitment_of(self: @TContractState, slot_key: felt252) -> felt252;
    fn is_nullifier_spent(self: @TContractState, nullifier: felt252) -> bool;
    /// The address permitted to drive transitions - the ClaimAnonymizer.
    fn anonymizer(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod RightsRegistry {
    use super::{IRightsRegistry, RightState};
    use core::num::traits::Zero;
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess,
        StorageMapReadAccess, StorageMapWriteAccess,
    };

    #[storage]
    struct Storage {
        // slot_key -> state
        state: Map<felt252, RightState>,
        // slot_key -> active claim commitment (0 when not active)
        commitment: Map<felt252, felt252>,
        // slot_key -> registered flag (distinguishes UNCLAIMED-existing from unknown)
        registered: Map<felt252, bool>,
        // nullifier -> spent
        nullifiers: Map<felt252, bool>,
        // only the anonymizer may drive transitions, so the raw claiming
        // wallet is never the msg.sender the registry records.
        anonymizer: ContractAddress,
        // who deployed this registry - the only address initialize_anonymizer
        // will accept a call from. Set once at construction, read-only after.
        deployer: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        RightRegistered: RightRegistered,
        RightClaimed: RightClaimed,
        RightConsumed: RightConsumed,
    }

    // Events carry ONLY the slot_key and (for claim) the opaque commitment.
    // No identity, amount, or counterparty is ever emitted.
    #[derive(Drop, starknet::Event)]
    pub struct RightRegistered { #[key] pub slot_key: felt252 }
    #[derive(Drop, starknet::Event)]
    pub struct RightClaimed { #[key] pub slot_key: felt252, pub commitment: felt252 }
    #[derive(Drop, starknet::Event)]
    pub struct RightConsumed { #[key] pub slot_key: felt252 }

    pub mod Errors {
        pub const NOT_ANONYMIZER: felt252 = 'CALLER_NOT_ANONYMIZER';
        pub const ALREADY_REGISTERED: felt252 = 'RIGHT_ALREADY_REGISTERED';
        pub const NOT_REGISTERED: felt252 = 'RIGHT_NOT_REGISTERED';
        pub const ALREADY_ACTIVE: felt252 = 'RIGHT_ALREADY_ACTIVE';
        pub const NOT_ACTIVE: felt252 = 'RIGHT_NOT_ACTIVE';
        pub const NULLIFIER_SPENT: felt252 = 'NULLIFIER_ALREADY_SPENT';
        pub const ZERO_COMMITMENT: felt252 = 'ZERO_COMMITMENT';
        pub const NOT_DEPLOYER: felt252 = 'CALLER_NOT_DEPLOYER';
        pub const ALREADY_INITIALIZED: felt252 = 'ANONYMIZER_ALREADY_SET';
    }

    #[constructor]
    fn constructor(ref self: ContractState, deployer: ContractAddress) {
        // Explicit, not get_caller_address(): a deploy routed through the
        // Universal Deployer Contract makes the constructor's caller the UDC,
        // not the account that submitted the transaction. The deployer must
        // pass their own address deliberately.
        self.deployer.write(deployer);
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        fn assert_anonymizer(self: @ContractState) {
            assert(get_caller_address() == self.anonymizer.read(), Errors::NOT_ANONYMIZER);
        }
    }

    #[abi(embed_v0)]
    impl RightsRegistryImpl of IRightsRegistry<ContractState> {
        fn initialize_anonymizer(ref self: ContractState, anonymizer: ContractAddress) {
            assert(get_caller_address() == self.deployer.read(), Errors::NOT_DEPLOYER);
            assert(self.anonymizer.read().is_zero(), Errors::ALREADY_INITIALIZED);
            self.anonymizer.write(anonymizer);
        }

        fn register_right(ref self: ContractState, slot_key: felt252) {
            self.assert_anonymizer();
            assert(!self.registered.read(slot_key), Errors::ALREADY_REGISTERED);
            self.registered.write(slot_key, true);
            self.state.write(slot_key, RightState::Unclaimed);
            self.emit(Event::RightRegistered(RightRegistered { slot_key }));
        }

        fn claim(ref self: ContractState, slot_key: felt252, claim_commitment: felt252) {
            self.assert_anonymizer();
            assert(claim_commitment != 0, Errors::ZERO_COMMITMENT);
            assert(self.registered.read(slot_key), Errors::NOT_REGISTERED);
            // THE INVARIANT: a slot already ACTIVE cannot be claimed again.
            assert(self.state.read(slot_key) == RightState::Unclaimed, Errors::ALREADY_ACTIVE);
            self.state.write(slot_key, RightState::Active);
            self.commitment.write(slot_key, claim_commitment);
            self.emit(Event::RightClaimed(RightClaimed { slot_key, commitment: claim_commitment }));
        }

        fn settle(ref self: ContractState, slot_key: felt252, nullifier: felt252) {
            self.assert_anonymizer();
            assert(self.state.read(slot_key) == RightState::Active, Errors::NOT_ACTIVE);
            assert(!self.nullifiers.read(nullifier), Errors::NULLIFIER_SPENT);
            self.nullifiers.write(nullifier, true);
            self.state.write(slot_key, RightState::Consumed);
            self.commitment.write(slot_key, 0);
            self.emit(Event::RightConsumed(RightConsumed { slot_key }));
        }

        fn state_of(self: @ContractState, slot_key: felt252) -> RightState {
            self.state.read(slot_key)
        }
        fn commitment_of(self: @ContractState, slot_key: felt252) -> felt252 {
            self.commitment.read(slot_key)
        }
        fn is_nullifier_spent(self: @ContractState, nullifier: felt252) -> bool {
            self.nullifiers.read(nullifier)
        }
        fn anonymizer(self: @ContractState) -> ContractAddress {
            self.anonymizer.read()
        }
    }
}

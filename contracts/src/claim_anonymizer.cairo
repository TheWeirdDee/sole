// SPDX-License-Identifier: Apache-2.0
//
// Sole - ClaimAnonymizer
// The mandatory STRK20 privacy boundary (see DECISIONS.md D-005). Without it,
// the wallet that calls RightsRegistry.claim() becomes msg.sender on the
// public transition, linking a real identity to the exclusive right and
// defeating the entire thesis.
//
// The anonymizer is invoked through the STRK20 pool's privacy_invoke path:
// the pool proves a shielded funding note was spent and drives this contract,
// so the registry only ever sees the anonymizer as caller. The claiming
// wallet never appears on the RightsRegistry transition.
//
//   claimant wallet
//        | shielded STRK20 funding note (private_transfer)
//        v
//   STRK20 pool  --privacy_invoke-->  ClaimAnonymizer
//                                          |
//                                          v
//                                   RightsRegistry.claim()
//
// NOTE ON SCOPE: the funding-note verification is delegated to the STRK20
// pool via privacy_invoke (the pool proves the note in zero knowledge before
// calling here). This contract is the application-side execution boundary; it
// forwards the claim/settle into the registry under its own address. See
// docs/INTEGRATING.md for the exact privacy_invoke wiring and the SDK path.

use starknet::ContractAddress;
use sole_contracts::execution_adapter::ExecAuth;

#[starknet::interface]
pub trait IClaimAnonymizer<TContractState> {
    fn register(ref self: TContractState, slot_key: felt252);
    fn claim_through(ref self: TContractState, slot_key: felt252, claim_commitment: felt252);
    fn settle_through(ref self: TContractState, slot_key: felt252, nullifier: felt252);
    /// Drive one financing action against the venue. Only reaches the adapter
    /// because the pool proved a shielded funding note (privacy_invoke). The
    /// adapter itself re-checks that Sole says the right is ACTIVE.
    fn finance_through(
        ref self: TContractState, adapter: ContractAddress, auth: ExecAuth, amount_commitment: felt252,
    );
    /// Settle: repay the venue position and consume the Sole right atomically.
    fn settle_and_repay(
        ref self: TContractState, adapter: ContractAddress, slot_key: felt252, nullifier: felt252, auth: ExecAuth,
    );
    fn registry(self: @TContractState) -> ContractAddress;
    fn pool(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod ClaimAnonymizer {
    use super::IClaimAnonymizer;
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StoragePointerReadAccess, StoragePointerWriteAccess};
    use sole_contracts::rights_registry::{
        IRightsRegistryDispatcher, IRightsRegistryDispatcherTrait,
    };
    use sole_contracts::execution_adapter::{
        IExecutionAdapterDispatcher, IExecutionAdapterDispatcherTrait, ExecAuth,
    };

    #[storage]
    struct Storage {
        registry: ContractAddress,
        // the STRK20 privacy pool: only it may drive claim/settle, because
        // only it can prove a shielded funding note was spent to get here.
        pool: ContractAddress,
    }

    pub mod Errors {
        pub const NOT_POOL: felt252 = 'CALLER_NOT_POOL';
    }

    #[constructor]
    fn constructor(ref self: ContractState, registry: ContractAddress, pool: ContractAddress) {
        self.registry.write(registry);
        self.pool.write(pool);
    }

    #[generate_trait]
    impl Internal of InternalTrait {
        // Transitions that move value must originate from the pool's
        // privacy_invoke, so the funding note is proven and the raw wallet is
        // never the caller the registry records.
        fn assert_pool(self: @ContractState) {
            assert(get_caller_address() == self.pool.read(), Errors::NOT_POOL);
        }
        fn reg(self: @ContractState) -> IRightsRegistryDispatcher {
            IRightsRegistryDispatcher { contract_address: self.registry.read() }
        }
    }

    #[abi(embed_v0)]
    impl ClaimAnonymizerImpl of IClaimAnonymizer<ContractState> {
        // Registration carries no value, so it does not require the pool path.
        fn register(ref self: ContractState, slot_key: felt252) {
            self.reg().register_right(slot_key);
        }

        // Claim binds shielded funding -> must arrive via privacy_invoke.
        fn claim_through(ref self: ContractState, slot_key: felt252, claim_commitment: felt252) {
            self.assert_pool();
            self.reg().claim(slot_key, claim_commitment);
        }

        // Settlement consumes the private claim -> also via privacy_invoke.
        fn settle_through(ref self: ContractState, slot_key: felt252, nullifier: felt252) {
            self.assert_pool();
            self.reg().settle(slot_key, nullifier);
        }

        fn finance_through(
            ref self: ContractState, adapter: ContractAddress, auth: ExecAuth, amount_commitment: felt252,
        ) {
            self.assert_pool();
            IExecutionAdapterDispatcher { contract_address: adapter }.finance(auth, amount_commitment);
        }

        fn settle_and_repay(
            ref self: ContractState, adapter: ContractAddress, slot_key: felt252, nullifier: felt252, auth: ExecAuth,
        ) {
            self.assert_pool();
            // repay the venue first, then consume the right - both or neither.
            IExecutionAdapterDispatcher { contract_address: adapter }.settle(auth);
            self.reg().settle(slot_key, nullifier);
        }

        fn registry(self: @ContractState) -> ContractAddress { self.registry.read() }
        fn pool(self: @ContractState) -> ContractAddress { self.pool.read() }
    }
}

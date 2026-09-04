// SPDX-License-Identifier: Apache-2.0
//
// Sole - ClaimAnonymizer
// The mandatory STRK20 privacy boundary (see DECISIONS.md D-005). Without it,
// the wallet that calls RightsRegistry.claim() becomes msg.sender on the
// public transition, linking a real identity to the exclusive right and
// defeating the entire thesis.
//
// This is a standard STRK20 anonymizer helper: the pool calls it through the
// same privacy_invoke seam as every other helper (Swap, Vesu, Escrow) - one
// entry point, named privacy_invoke, dispatched by an operation argument,
// called via the pool's INVOKE_SELECTOR once it has proved a shielded
// funding note was spent. The registry only ever sees the anonymizer as
// caller; the claiming wallet never appears on the RightsRegistry
// transition.
//
//   claimant wallet
//        | shielded STRK20 funding note (private_transfer)
//        v
//   STRK20 pool  --privacy_invoke(operation, ...)-->  ClaimAnonymizer
//                                          |
//                                          v
//                          RightsRegistry / ExecutionAdapter
//
// Sole's operations are state transitions, not value handed back to the
// pool, so privacy_invoke returns an empty Span<OpenNoteDeposit> in every
// branch - the same shape the Escrow reference helper returns for its
// Deposit case ("tokens stay parked, nothing to credit yet"). See
// docs/INTEGRATING.md for the exact wiring and the SDK path.

use starknet::ContractAddress;
use sole_contracts::execution_adapter::ExecAuth;

/// Mirrors privacy::objects::OpenNoteDeposit (the STRK20 pool ABI every
/// privacy_invoke helper returns). Defined locally rather than as a
/// dependency on the full starknet-privacy workspace: Starknet calldata is
/// structural, so matching field order and types is what the pool's
/// deserializer actually requires.
#[derive(Copy, Drop, Serde)]
pub struct OpenNoteDeposit {
    pub note_id: felt252,
    pub token: ContractAddress,
    pub amount: u128,
}

/// The action the pool is driving through privacy_invoke. Mirrors the
/// Escrow reference helper's operation-enum pattern: one entry point,
/// dispatched by an enum, rather than one entry point per action. Register
/// carries no value and is not in this enum - it stays a direct, ungated
/// call (see IClaimAnonymizer::register).
#[derive(Serde, Copy, Drop, PartialEq, Debug)]
pub enum ClaimOperation {
    Claim,
    Settle,
    Finance,
    SettleAndRepay,
}

#[starknet::interface]
pub trait IClaimAnonymizer<TContractState> {
    /// Registration carries no value and touches no privacy state, so it
    /// stays outside the privacy_invoke seam - anyone can register a right.
    fn register(ref self: TContractState, slot_key: felt252);

    /// The entry point every STRK20 anonymizer contract must expose. Calldata
    /// is deserialized positionally; each operation reads only the fields it
    /// needs and ignores the rest, the same convention the Escrow reference
    /// helper uses for its Deposit/Claim split.
    fn privacy_invoke(
        ref self: TContractState,
        operation: ClaimOperation,
        slot_key: felt252,
        claim_commitment: felt252,
        nullifier: felt252,
        adapter: ContractAddress,
        auth: ExecAuth,
        amount_commitment: felt252,
    ) -> Span<OpenNoteDeposit>;

    fn registry(self: @TContractState) -> ContractAddress;
    fn pool(self: @TContractState) -> ContractAddress;
}

#[starknet::contract]
pub mod ClaimAnonymizer {
    use super::{IClaimAnonymizer, ClaimOperation, OpenNoteDeposit};
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
        // the STRK20 privacy pool: only it may drive privacy_invoke, because
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

        fn privacy_invoke(
            ref self: ContractState,
            operation: ClaimOperation,
            slot_key: felt252,
            claim_commitment: felt252,
            nullifier: felt252,
            adapter: ContractAddress,
            auth: ExecAuth,
            amount_commitment: felt252,
        ) -> Span<OpenNoteDeposit> {
            self.assert_pool();
            match operation {
                // Claim binds shielded funding -> must arrive via privacy_invoke.
                ClaimOperation::Claim => { self.reg().claim(slot_key, claim_commitment); },
                // Settlement consumes the private claim -> also via privacy_invoke.
                ClaimOperation::Settle => { self.reg().settle(slot_key, nullifier); },
                ClaimOperation::Finance => {
                    IExecutionAdapterDispatcher { contract_address: adapter }
                        .finance(auth, amount_commitment);
                },
                ClaimOperation::SettleAndRepay => {
                    // repay the venue first, then consume the right - both or neither.
                    IExecutionAdapterDispatcher { contract_address: adapter }.settle(auth);
                    self.reg().settle(slot_key, nullifier);
                },
            };
            // State transitions only - nothing for the pool to credit.
            array![].span()
        }

        fn registry(self: @ContractState) -> ContractAddress { self.registry.read() }
        fn pool(self: @ContractState) -> ContractAddress { self.pool.read() }
    }
}

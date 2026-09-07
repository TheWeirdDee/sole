// SPDX-License-Identifier: Apache-2.0
//
// Sole - RightRoot
// Separates THREE concerns the protocol keeps distinct (see DECISIONS.md D-003):
//   1. What is the right?        -> canonical_asset_id -> slot_key  (identity)
//   2. Who is trusted to say it exists?  -> RightRoot               (input trust)
//   3. Which opaque claim can consume it? -> claim_commitment / nullifier
//
// The RightsRegistry is root-agnostic: it enforces exclusivity over whatever
// slot_key a root produces. Swapping the root NEVER changes the exclusivity
// logic. The MVP ships FirstRegistrationRoot; production swaps in AttestedRoot
// without touching the registry.

#[starknet::interface]
pub trait IRightRoot<TContractState> {
    /// Derive the deterministic exclusivity key from a canonical identifier.
    /// MUST be pure and independently reproducible by any party, or the
    /// exclusivity collision never happens. slot_key = Poseidon(TAG_SLOT, id).
    fn derive_slot_key(self: @TContractState, canonical_asset_id: felt252) -> felt252;

    /// Validate that this root accepts the (id, proof) pair as establishing a
    /// right. FirstRegistrationRoot accepts unconditionally (first caller
    /// wins). AttestedRoot verifies an attester signature over the id.
    fn validate_root(
        self: @TContractState, canonical_asset_id: felt252, root_proof: Span<felt252>,
    ) -> bool;
}

/// TAG constants (domain separation for every Poseidon hash in the protocol).
/// Mirrored byte-for-byte in packages/sole-sdk/src/derive.ts.
pub mod Tags {
    pub const TAG_SLOT: felt252 = 'sole:slot';
    pub const TAG_CLAIM: felt252 = 'sole:claim';
    pub const TAG_NULL: felt252 = 'sole:nullifier';
}

/// MVP root. No external attester. The exclusivity guarantee is over the
/// commitment, not over the real-world asset - documented honestly in
/// THREAT_MODEL.md T-1. This is the smallest thing that proves the thesis.
#[starknet::contract]
pub mod FirstRegistrationRoot {
    use super::{IRightRoot, Tags};
    use core::poseidon::poseidon_hash_span;

    #[storage]
    struct Storage {}

    #[abi(embed_v0)]
    impl RootImpl of IRightRoot<ContractState> {
        fn derive_slot_key(self: @ContractState, canonical_asset_id: felt252) -> felt252 {
            poseidon_hash_span(array![Tags::TAG_SLOT, canonical_asset_id].span())
        }
        fn validate_root(
            self: @ContractState, canonical_asset_id: felt252, root_proof: Span<felt252>,
        ) -> bool {
            // First-registration-wins: any well-formed id is acceptable; the
            // RightsRegistry enforces "first one through the door wins".
            canonical_asset_id != 0
        }
    }
}

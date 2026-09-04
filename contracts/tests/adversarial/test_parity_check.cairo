// Cross-language derivation parity: the expected values here come from the
// TS SDK's derive.ts functions for the same fixed inputs (computed via
// starknet.js and pasted here). Mirrored by packages/sole-sdk/src/derive.test.ts,
// which asserts the same fixed inputs against the same expected outputs from
// the TS side. If either implementation drifts, exactly one suite goes red.
use core::poseidon::poseidon_hash_span;
use sole_contracts::execution_adapter::ExecTags;
use sole_contracts::right_root::Tags;

const CANONICAL_ASSET_ID: felt252 = 0x1234;
const CLAIMANT_SECRET: felt252 = 0x5678;
const FUNDING_NOTE: felt252 = 0x9abc;

#[test]
fn parity_slot_key() {
    let slot_key = poseidon_hash_span([Tags::TAG_SLOT, CANONICAL_ASSET_ID].span());
    assert(slot_key == 0x772f0e8c5be3279ae5f955a79659ebc59f47d13bd7789c93584274608fece4, 'SLOT_KEY_MISMATCH');
}

#[test]
fn parity_claim_commitment() {
    let slot_key = poseidon_hash_span([Tags::TAG_SLOT, CANONICAL_ASSET_ID].span());
    let commitment = poseidon_hash_span(
        [Tags::TAG_CLAIM, slot_key, CLAIMANT_SECRET, FUNDING_NOTE].span(),
    );
    assert(commitment == 0x1a98f08ac13c2fa57e35f2de5ac9acc98bc9b531932b09c910a90baecf4aad2, 'CLAIM_COMMITMENT_MISMATCH');
}

#[test]
fn parity_nullifier() {
    let slot_key = poseidon_hash_span([Tags::TAG_SLOT, CANONICAL_ASSET_ID].span());
    let nullifier = poseidon_hash_span([Tags::TAG_NULL, CLAIMANT_SECRET, slot_key].span());
    assert(nullifier == 0x30d6f5527bf918c65a0ec48cb05b820bc522c6f1a0b866455243f550345c561, 'NULLIFIER_MISMATCH');
}

#[test]
fn parity_exec_nonce() {
    let slot_key = poseidon_hash_span([Tags::TAG_SLOT, CANONICAL_ASSET_ID].span());
    let commitment = poseidon_hash_span(
        [Tags::TAG_CLAIM, slot_key, CLAIMANT_SECRET, FUNDING_NOTE].span(),
    );
    let nonce = poseidon_hash_span([ExecTags::TAG_EXEC, slot_key, commitment].span());
    assert(nonce == 0x36eaf50f6d87aabcea000e770d7cd3d186f73f195b0fc0f9fec049842502070, 'EXEC_NONCE_MISMATCH');
}

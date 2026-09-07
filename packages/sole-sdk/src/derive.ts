// SPDX-License-Identifier: Apache-2.0
//
// Sole SDK - derivation
// The single source of truth for how Sole's client-held inputs are derived.
// These MUST match contracts/src/right_root.cairo::Tags exactly, byte for
// byte. Cross-language parity is asserted against fixed vectors in
// derive.test.ts: if either implementation drifts, exactly one suite goes red.
//
//   slot_key     = Poseidon(TAG_SLOT, canonical_asset_id)
//                  -> shared, deterministic, ANY party can derive it.
//                     This is what makes a second claimant collide.
//   claim_record = Poseidon(TAG_CLAIM, slot_key, claimant_secret, funding_note)
//                  -> opaque public commitment; its preimages are not emitted
//                     by the registry event.
//   nullifier    = Poseidon(TAG_NULL, claimant_secret, slot_key)
//                  -> consumes the claim once; requires claimant_secret.
//
// PRIVACY BOUNDARY (see docs/PRIVACY_BOUNDARY.md): the salt/blinding lives in
// the claim commitment, never in the slot_key. Anyone holding
// canonical_asset_id can read the right's public state. This derivation does
// not make a wallet unlinkable: pool deposit events, timing, and the atomic
// receipt can still provide public correlation evidence.

import { hash, shortString } from "starknet";

// Domain-separation tags. shortString.encodeShortString('sole:slot') must equal
// the felt 'sole:slot' the Cairo side uses. Asserted in derive.test.ts.
export const TAG_SLOT = shortString.encodeShortString("sole:slot");
export const TAG_CLAIM = shortString.encodeShortString("sole:claim");
export const TAG_NULL = shortString.encodeShortString("sole:nullifier");
export const TAG_EXEC = shortString.encodeShortString("sole:exec");

export type Felt = string;

/** Deterministic exclusivity key. Reproducible by any party from the id. */
export function deriveSlotKey(canonicalAssetId: Felt): Felt {
  return hash.computePoseidonHashOnElements([TAG_SLOT, canonicalAssetId]);
}

/**
 * Opaque commitment written on-chain. Its client-held preimages are not stored
 * in clear by the registry, but the commitment is not a wallet-privacy claim.
 */
export function deriveClaimCommitment(
  slotKey: Felt,
  claimantSecret: Felt,
  fundingNote: Felt,
): Felt {
  return hash.computePoseidonHashOnElements([TAG_CLAIM, slotKey, claimantSecret, fundingNote]);
}

/** Public single-use marker derived from client-held inputs for settlement. */
export function deriveNullifier(claimantSecret: Felt, slotKey: Felt): Felt {
  return hash.computePoseidonHashOnElements([TAG_NULL, claimantSecret, slotKey]);
}

/** Single-use execution-auth nonce that binds an adapter action to this claim.
 *  nonce = Poseidon(TAG_EXEC, slot_key, claim_commitment). The adapter also
 *  independently checks Sole says the right is ACTIVE, so a leaked nonce alone
 *  authorizes nothing.
 *  (shared-registry adapter, non-ACTIVE) --finance--> REVERT AUTH_RIGHT_NOT_ACTIVE
 */
export function deriveExecNonce(slotKey: Felt, claimCommitment: Felt): Felt {
  return hash.computePoseidonHashOnElements([TAG_EXEC, slotKey, claimCommitment]);
}

/**
 * Convenience: canonicalize a human asset reference into a felt id.
 * MVP uses a plain hash of the reference string. Documented honestly in
 * THREAT_MODEL.md T-1: this establishes exclusivity over the COMMITMENT, not
 * proof that a real receivable exists. Production replaces this with an
 * attested canonical id (AttestedRoot).
 */
export function canonicalAssetId(reference: string): Felt {
  return hash.computePoseidonHashOnElements([shortString.encodeShortString("sole:asset"),
    hash.starknetKeccak(reference).toString()]);
}

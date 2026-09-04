// SPDX-License-Identifier: Apache-2.0
//
// Cross-language derivation parity. Fixed inputs, expected outputs computed
// once via these same functions and independently verified against Cairo's
// poseidon_hash_span in contracts/tests/adversarial/test_parity_check.cairo.
// If either implementation drifts, exactly one suite goes red - this one
// existing at all closes a real gap: nothing previously verified that this
// SDK's Poseidon output actually matches what the deployed contracts expect,
// even though the execution-auth nonce check added in execution_adapter.cairo
// depends on that match exactly.

import test from "node:test";
import assert from "node:assert/strict";
import { deriveSlotKey, deriveClaimCommitment, deriveNullifier, deriveExecNonce } from "./derive.ts";

const CANONICAL_ASSET_ID = "0x1234";
const CLAIMANT_SECRET = "0x5678";
const FUNDING_NOTE = "0x9abc";

test("deriveSlotKey matches Cairo poseidon_hash_span([TAG_SLOT, id])", () => {
  const slotKey = deriveSlotKey(CANONICAL_ASSET_ID);
  assert.equal(slotKey, "0x772f0e8c5be3279ae5f955a79659ebc59f47d13bd7789c93584274608fece4");
});

test("deriveClaimCommitment matches Cairo poseidon_hash_span([TAG_CLAIM, slot, secret, note])", () => {
  const slotKey = deriveSlotKey(CANONICAL_ASSET_ID);
  const commitment = deriveClaimCommitment(slotKey, CLAIMANT_SECRET, FUNDING_NOTE);
  assert.equal(commitment, "0x1a98f08ac13c2fa57e35f2de5ac9acc98bc9b531932b09c910a90baecf4aad2");
});

test("deriveNullifier matches Cairo poseidon_hash_span([TAG_NULL, secret, slot])", () => {
  const slotKey = deriveSlotKey(CANONICAL_ASSET_ID);
  const nullifier = deriveNullifier(CLAIMANT_SECRET, slotKey);
  assert.equal(nullifier, "0x30d6f5527bf918c65a0ec48cb05b820bc522c6f1a0b866455243f550345c561");
});

test("deriveExecNonce matches Cairo poseidon_hash_span([TAG_EXEC, slot, commitment])", () => {
  const slotKey = deriveSlotKey(CANONICAL_ASSET_ID);
  const commitment = deriveClaimCommitment(slotKey, CLAIMANT_SECRET, FUNDING_NOTE);
  const nonce = deriveExecNonce(slotKey, commitment);
  assert.equal(nonce, "0x36eaf50f6d87aabcea000e770d7cd3d186f73f195b0fc0f9fec049842502070");
});

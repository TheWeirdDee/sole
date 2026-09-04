"use client";
// Browser counterpart to scripts/verify-mainnet.ts - same checks, same
// address-comparison fix (BigInt, not string: RPC responses drop the
// leading zero padding deployment addresses are stored with), reading
// from the live provider/addresses instead of local evidence files.

import { hash } from "starknet";
import { provider, ADDRS } from "./sole";

const SEL = {
  RightRegistered: hash.getSelectorFromName("RightRegistered"),
  RightClaimed: hash.getSelectorFromName("RightClaimed"),
  RightConsumed: hash.getSelectorFromName("RightConsumed"),
};

export interface CheckLine { ok: boolean; label: string }
export interface VerifyResult { txHash: string; kind: string; lines: CheckLine[] }

export async function verifyTx(txHash: string): Promise<VerifyResult> {
  const lines: CheckLine[] = [];
  const push = (ok: boolean, label: string) => lines.push({ ok, label });

  let receipt: any;
  try {
    receipt = await provider.getTransactionReceipt(txHash);
  } catch (e: any) {
    push(false, `could not fetch receipt: ${e?.message ?? e}`);
    return { txHash, kind: "error", lines };
  }

  const reverted = receipt.execution_status === "REVERTED";
  const registryAddr = BigInt(ADDRS.registry);
  const soleEvents = (receipt.events ?? []).filter(
    (e: any) => e.from_address != null && BigInt(e.from_address) === registryAddr,
  );

  if (reverted) {
    const reason = receipt.revert_reason ?? "";
    if (reason.includes("RIGHT_ALREADY_ACTIVE")) {
      push(true, "reverted with RIGHT_ALREADY_ACTIVE (duplicate claim refused)");
      if (soleEvents.length === 0) push(true, "no state-changing event emitted (fail-closed)");
      else push(false, "rejected tx unexpectedly emitted a registry event");
      return { txHash, kind: "rejection", lines };
    }
    if (reason.includes("AUTH_RIGHT_NOT_ACTIVE")) {
      push(true, "reverted with AUTH_RIGHT_NOT_ACTIVE (venue refused a right that isn't ACTIVE)");
      if (soleEvents.length === 0) push(true, "no state-changing event emitted (fail-closed)");
      else push(false, "rejected tx unexpectedly emitted a registry event");
      return { txHash, kind: "venue-rejection", lines };
    }
    push(false, `reverted for an unexpected reason: ${reason}`);
    return { txHash, kind: "unexpected-revert", lines };
  }

  if (soleEvents.length === 0) {
    push(false, "no Sole RightsRegistry event in this transaction");
    return { txHash, kind: "no-event", lines };
  }
  push(true, "emitted by the Sole RightsRegistry");

  let tx: any;
  try {
    tx = await provider.getTransaction(txHash);
  } catch (e: any) {
    push(false, `could not fetch transaction: ${e?.message ?? e}`);
    return { txHash, kind: "error", lines };
  }
  const anonymizerUnpadded = BigInt(ADDRS.anonymizer).toString(16);
  const touchesAnonymizer = JSON.stringify(tx).toLowerCase().includes(anonymizerUnpadded);
  push(touchesAnonymizer, touchesAnonymizer
    ? "routed via the ClaimAnonymizer (claimant wallet unlinked)"
    : "transaction did not route through the ClaimAnonymizer");

  const kinds = soleEvents.map((e: any) => e.keys?.[0]);
  let kind = "unknown";
  if (kinds.includes(SEL.RightClaimed)) { push(true, "decodes to claim -> ACTIVE"); kind = "claim"; }
  else if (kinds.includes(SEL.RightConsumed)) { push(true, "decodes to settle -> CONSUMED"); kind = "settle"; }
  else if (kinds.includes(SEL.RightRegistered)) { push(true, "decodes to register -> UNCLAIMED"); kind = "register"; }
  else push(false, "no recognized Sole transition in the emitted events");

  return { txHash, kind, lines };
}

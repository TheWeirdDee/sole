"use client";
// Browser counterpart to scripts/verify-mainnet.ts - same checks, same
// address-comparison fix (BigInt, not string: RPC responses drop the
// leading zero padding deployment addresses are stored with), reading
// from the live provider/addresses instead of local evidence files.

import { hash } from "starknet";
import { provider, ADDRS, ADAPTER_VENUE_2 } from "./sole";

const SEL = {
  RightRegistered: hash.getSelectorFromName("RightRegistered"),
  RightClaimed: hash.getSelectorFromName("RightClaimed"),
  RightConsumed: hash.getSelectorFromName("RightConsumed"),
  Financed: hash.getSelectorFromName("Financed"),
  Repaid: hash.getSelectorFromName("Repaid"),
  Deposit: hash.getSelectorFromName("Deposit"),
  ExternalContractInvoked: hash.getSelectorFromName("ExternalContractInvoked"),
  PrivacyInvoke: hash.getSelectorFromName("privacy_invoke"),
};

const adapterAddrs = [ADDRS.adapter, ADAPTER_VENUE_2]
  .filter((a): a is string => Boolean(a))
  .map((a) => BigInt(a));

export interface CheckLine { ok: boolean; label: string }
export interface VerifyResult { txHash: string; kind: string; lines: CheckLine[] }

function sameFelt(a: unknown, b: unknown): boolean {
  try { return BigInt(a as string) === BigInt(b as string); } catch { return false; }
}

function formatFri(value: unknown): string {
  const amount = BigInt(value as string);
  const unit = 1_000_000_000_000_000_000n;
  const whole = amount / unit;
  const fraction = (amount % unit).toString().padStart(18, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} STRK` : `${whole} STRK`;
}

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
  const adapterEvents = (receipt.events ?? []).filter(
    (e: any) => e.from_address != null && adapterAddrs.some((a) => BigInt(e.from_address) === a),
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

  if (soleEvents.length === 0 && adapterEvents.length === 0) {
    push(false, "no Sole RightsRegistry or ExecutionAdapter event in this transaction");
    return { txHash, kind: "no-event", lines };
  }
  if (soleEvents.length > 0) push(true, "emitted by the Sole RightsRegistry");
  else push(true, "emitted by a known Sole ExecutionAdapter (the position record uses a registry view call)");

  const kinds = soleEvents.map((e: any) => e.keys?.[0]);
  const adapterKinds = adapterEvents.map((e: any) => e.keys?.[0]);
  let kind = "unknown";
  if (kinds.includes(SEL.RightClaimed)) { push(true, "decodes to claim -> ACTIVE"); kind = "claim"; }
  else if (kinds.includes(SEL.RightConsumed)) {
    push(true, "decodes to settle -> CONSUMED");
    if (adapterKinds.includes(SEL.Repaid)) push(true, "adapter also emitted Repaid (position record cleared atomically)");
    kind = "settle";
  } else if (kinds.includes(SEL.RightRegistered)) { push(true, "decodes to register -> UNCLAIMED"); kind = "register"; }
  else if (adapterKinds.includes(SEL.Financed)) {
    push(true, "adapter emitted Financed -> position record accepted for an ACTIVE right");
    kind = "record-position";
  } else push(false, "no recognized Sole transition in the emitted events");

  const feeRaw = receipt.actual_fee?.amount ?? receipt.actual_fee;
  if (feeRaw != null) push(true, `actual L2 fee ${formatFri(feeRaw)}`);

  if (kind === "register") {
    try {
      const tx: any = await provider.getTransaction(txHash);
      const anonymizerUnpadded = BigInt(ADDRS.anonymizer).toString(16);
      const referencesAnonymizer = JSON.stringify(tx).toLowerCase().includes(anonymizerUnpadded);
      push(referencesAnonymizer,
        referencesAnonymizer
          ? "direct registration calldata references the configured anonymizer"
          : "direct registration calldata does not reference the configured anonymizer",
      );
    } catch (e: any) {
      push(false, `could not fetch direct-registration transaction: ${e?.message ?? e}`);
    }
    return { txHash, kind, lines };
  }

  const poolEvents = (receipt.events ?? []).filter(
    (e: any) => e.from_address != null && sameFelt(e.from_address, ADDRS.pool),
  );
  const poolInvokedAnonymizer = poolEvents.some((e: any) =>
    sameFelt(e.keys?.[0], SEL.ExternalContractInvoked)
    && sameFelt(e.keys?.[1], ADDRS.anonymizer)
    && sameFelt(e.keys?.[2], SEL.PrivacyInvoke),
  );
  push(poolInvokedAnonymizer,
    poolInvokedAnonymizer
      ? "pool invoked the configured anonymizer through privacy_invoke"
      : "receipt lacks the configured pool -> anonymizer privacy_invoke event",
  );
  const deposit = poolEvents.find((e: any) => sameFelt(e.keys?.[0], SEL.Deposit));
  if (deposit?.data?.[0] != null) {
    push(true, `receipt has a public pool Deposit of ${formatFri(deposit.data[0])}; its indexed depositor can correlate to this slot`);
  } else {
    push(true, "no public pool Deposit event found; this verifier does not infer wallet unlinkability either way");
  }

  return { txHash, kind, lines };
}

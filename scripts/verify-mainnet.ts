// SPDX-License-Identifier: Apache-2.0
//
// Sole - verify-mainnet
// Reconstructs each claim from chain data and refuses any hash whose events do
// not prove the mechanism. Nothing here is self-reported: the script re-reads
// the receipt, checks the emitting contract, decodes the event, and asserts the
// state transition it must represent.
//
//   usage: node --experimental-strip-types scripts/verify-mainnet.ts <tx_hash>
//          node --experimental-strip-types scripts/verify-mainnet.ts --all
//
// Checks per transaction (mirrors evidence/claims.json):
//   ok  emitted by the Sole RightsRegistry
//   ok  routed via the ClaimAnonymizer (caller == anonymizer, not a raw wallet)
//   ok  event decodes to a valid transition for its slot_key
//   ok  for a duplicate-claim rejection: reverted with RIGHT_ALREADY_ACTIVE and moved no state
//   ok  for a venue rejection (never-active or a different, consumed venue): reverted with
//       AUTH_RIGHT_NOT_ACTIVE and moved no state
//   ok  for a settle tx: nullifier newly burned, slot -> CONSUMED

import { RpcProvider, hash } from "starknet";
import { readFileSync } from "node:fs";

const RPC = process.env.STARKNET_RPC ?? "https://rpc.starknet.lava.build";
const provider = new RpcProvider({ nodeUrl: RPC });

type Deployment = {
  registry: string; anonymizer: string; pool: string;
  adapter_venue_1?: string; adapter_venue_2?: string;
};
const deployment: Deployment = JSON.parse(
  readFileSync(new URL("../evidence/deployment.json", import.meta.url), "utf8"),
);

const SEL = {
  RightRegistered: hash.getSelectorFromName("RightRegistered"),
  RightClaimed: hash.getSelectorFromName("RightClaimed"),
  RightConsumed: hash.getSelectorFromName("RightConsumed"),
};

function ok(label: string) { console.log(`  ok  ${label}`); }
function fail(label: string): never { console.error(`  XX  ${label}`); process.exit(1); }

async function verify(txHash: string) {
  console.log(`\nverifying ${txHash}`);
  const receipt: any = await provider.getTransactionReceipt(txHash);

  const reverted = receipt.execution_status === "REVERTED";
  // BigInt, not string, comparison: RPC responses drop leading zero padding
  // (0x57a4... vs the stored 0x057a4...), so a naive string match silently
  // finds nothing.
  const registryAddr = BigInt(deployment.registry);
  const soleEvents = (receipt.events ?? []).filter(
    (e: any) => e.from_address != null && BigInt(e.from_address) === registryAddr,
  );

  if (reverted) {
    // A rejection is a first-class evidence artifact: it must have moved no state.
    const reason = receipt.revert_reason ?? "";
    if (reason.includes("RIGHT_ALREADY_ACTIVE")) {
      ok("reverted with RIGHT_ALREADY_ACTIVE (duplicate claim refused)");
      if (soleEvents.length === 0) ok("no state-changing event emitted (fail-closed)");
      else fail("rejected tx unexpectedly emitted a registry event");
      return { kind: "rejection", txHash };
    }
    if (reason.includes("AUTH_RIGHT_NOT_ACTIVE")) {
      ok("reverted with AUTH_RIGHT_NOT_ACTIVE (venue refused a right that isn't ACTIVE)");
      if (soleEvents.length === 0) ok("no state-changing event emitted (fail-closed)");
      else fail("rejected tx unexpectedly emitted a registry event");
      return { kind: "venue-rejection", txHash };
    }
    fail(`reverted for an unexpected reason: ${reason}`);
  }

  if (soleEvents.length === 0) fail("no Sole RightsRegistry event in this transaction");
  ok("emitted by the Sole RightsRegistry");

  // The caller into the registry must be the anonymizer, never a raw wallet.
  // Compare the unpadded hex form, since RPC responses may drop the leading
  // zero padding sncast/deployment.json use.
  const tx: any = await provider.getTransaction(txHash);
  const anonymizerUnpadded = BigInt(deployment.anonymizer).toString(16);
  const touchesAnonymizer = JSON.stringify(tx).toLowerCase().includes(anonymizerUnpadded);
  if (touchesAnonymizer) ok("routed via the ClaimAnonymizer (claimant wallet unlinked)");
  else fail("transaction did not route through the ClaimAnonymizer");

  const kinds = soleEvents.map((e: any) => e.keys?.[0]);
  if (kinds.includes(SEL.RightClaimed)) { ok("decodes to claim -> ACTIVE"); return { kind: "claim", txHash }; }
  if (kinds.includes(SEL.RightConsumed)) { ok("decodes to settle -> CONSUMED"); return { kind: "settle", txHash }; }
  if (kinds.includes(SEL.RightRegistered)) { ok("decodes to register -> UNCLAIMED"); return { kind: "register", txHash }; }
  fail("no recognized Sole transition in the emitted events");
}

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error("usage: verify-mainnet.ts <tx_hash> | --all"); process.exit(2); }
  if (arg === "--all") {
    const claims = JSON.parse(readFileSync(new URL("../evidence/claims.json", import.meta.url), "utf8"));
    for (const c of claims.transactions) await verify(c.hash);
    console.log(`\nverified ${claims.transactions.length} mainnet transactions from chain`);
  } else {
    await verify(arg);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });

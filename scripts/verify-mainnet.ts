// SPDX-License-Identifier: Apache-2.0
//
// Sole - verify-mainnet
// Reconstructs the recorded evidence ledger from live chain data. The ledger
// provides expected facts; this script obtains every receipt again and fails
// when a current read disagrees. It deliberately reports the public pool
// deposit separately from the receipt's actual L2 fee and pool withdrawal.
//
// usage:
//   node --experimental-strip-types scripts/verify-mainnet.ts <tx_hash>
//   node --experimental-strip-types scripts/verify-mainnet.ts --all

import { RpcProvider, hash } from "starknet";
import { readFileSync } from "node:fs";

const RPC = process.env.STARKNET_RPC || "https://starknet-rpc.publicnode.com";
const provider = new RpcProvider({ nodeUrl: RPC });
const UNIT = 1_000_000_000_000_000_000n;

type Deployment = {
  registry: string;
  anonymizer: string;
  pool: string;
  adapter_venue_1?: string;
  adapter_venue_2?: string;
};

type LedgerTransaction = {
  hash: string;
  kind?: string;
  block_number?: number;
  expected_event?: string;
  expected_revert?: string;
  actual_fee_fri?: string;
  pool_deposit_fri?: string | null;
  pool_fee_withdrawal_fri?: string | null;
};

const deployment: Deployment = JSON.parse(
  readFileSync(new URL("../evidence/deployment.json", import.meta.url), "utf8"),
);
const ledger = JSON.parse(
  readFileSync(new URL("../evidence/claims.json", import.meta.url), "utf8"),
) as { transactions: LedgerTransaction[] };

const SEL = {
  RightRegistered: hash.getSelectorFromName("RightRegistered"),
  RightClaimed: hash.getSelectorFromName("RightClaimed"),
  RightConsumed: hash.getSelectorFromName("RightConsumed"),
  Financed: hash.getSelectorFromName("Financed"),
  Repaid: hash.getSelectorFromName("Repaid"),
  Deposit: hash.getSelectorFromName("Deposit"),
  Withdrawal: hash.getSelectorFromName("Withdrawal"),
  ExternalContractInvoked: hash.getSelectorFromName("ExternalContractInvoked"),
  PrivacyInvoke: hash.getSelectorFromName("privacy_invoke"),
};

const adapterAddrs = [deployment.adapter_venue_1, deployment.adapter_venue_2]
  .filter((address): address is string => Boolean(address))
  .map((address) => BigInt(address));

function ok(label: string) { console.log(`  ok  ${label}`); }
function fail(label: string): never { console.error(`  XX  ${label}`); process.exit(1); }

function sameFelt(a: unknown, b: unknown): boolean {
  try { return BigInt(a as string) === BigInt(b as string); } catch { return false; }
}

function formatFri(value: unknown): string {
  const amount = BigInt(value as string);
  const whole = amount / UNIT;
  const remainder = (amount % UNIT).toString().padStart(18, "0").replace(/0+$/, "");
  return remainder ? `${whole}.${remainder} STRK` : `${whole} STRK`;
}

function expectedEventPresent(entry: LedgerTransaction, registryEvents: any[], adapterEvents: any[]): boolean {
  const registryKinds = registryEvents.map((event) => event.keys?.[0]);
  const adapterKinds = adapterEvents.map((event) => event.keys?.[0]);
  switch (entry.expected_event) {
    case "RightRegistered": return registryKinds.includes(SEL.RightRegistered);
    case "RightClaimed": return registryKinds.includes(SEL.RightClaimed);
    case "Financed": return adapterKinds.includes(SEL.Financed);
    case "RightConsumed + Repaid":
      return registryKinds.includes(SEL.RightConsumed) && adapterKinds.includes(SEL.Repaid);
    default: return registryEvents.length > 0 || adapterEvents.length > 0;
  }
}

function verifyRecordedBlockAndFee(entry: LedgerTransaction, receipt: any) {
  if (entry.block_number === undefined) {
    fail("ledger rejection is missing its recorded block number");
  }
  if (Number(receipt.block_number) === entry.block_number) ok(`block ${entry.block_number}`);
  else fail(`block ${receipt.block_number} differs from ledger block ${entry.block_number}`);

  if (!entry.actual_fee_fri) fail("ledger rejection is missing its recorded actual fee");
  const feeRaw = receipt.actual_fee?.amount ?? receipt.actual_fee;
  if (feeRaw == null) fail("receipt has no actual_fee");
  if (!sameFelt(feeRaw, entry.actual_fee_fri)) {
    fail(`actual fee ${feeRaw} differs from ledger ${entry.actual_fee_fri}`);
  }
  ok(`actual L2 fee ${formatFri(feeRaw)} (${feeRaw} FRI)`);
}

function verifyDuplicateClaimRejection(entry: LedgerTransaction, receipt: any) {
  if (receipt.execution_status !== "REVERTED") {
    fail(`duplicate-claim rejection is ${receipt.execution_status ?? "missing"}, not REVERTED`);
  }
  if (entry.expected_revert !== "RIGHT_ALREADY_ACTIVE") {
    fail("duplicate-claim rejection must record expected_revert RIGHT_ALREADY_ACTIVE");
  }
  const reason = receipt.revert_reason ?? "";
  if (!reason.includes(entry.expected_revert)) {
    fail(`reverted for an unexpected reason: ${reason || "missing revert reason"}`);
  }
  ok(`expected rejection: ${entry.expected_revert}`);
  verifyRecordedBlockAndFee(entry, receipt);

  const registryEvents = (receipt.events ?? []).filter(
    (event: any) => event.from_address != null && sameFelt(event.from_address, deployment.registry),
  );
  const adapterEvents = (receipt.events ?? []).filter(
    (event: any) => event.from_address != null
      && adapterAddrs.some((address) => sameFelt(event.from_address, address)),
  );
  if (registryEvents.length !== 0 || adapterEvents.length !== 0) {
    fail("rejected duplicate claim unexpectedly emitted a Sole state-transition event");
  }
  ok("no registry or adapter state-transition event emitted");
}

async function verify(entry: LedgerTransaction) {
  console.log(`\nverifying ${entry.hash}`);
  const receipt: any = await provider.getTransactionReceipt(entry.hash);
  if (entry.kind === "duplicate-claim-rejection") {
    verifyDuplicateClaimRejection(entry, receipt);
    return;
  }

  if (receipt.execution_status === "REVERTED") {
    fail(`receipt reverted but ledger entry is not a declared rejection: ${receipt.revert_reason ?? "missing revert reason"}`);
  }

  if (receipt.execution_status !== "SUCCEEDED") {
    fail(`execution status is ${receipt.execution_status ?? "missing"}, not SUCCEEDED`);
  }
  ok(`SUCCEEDED; finality ${receipt.finality_status ?? "not returned"}`);

  if (entry.block_number !== undefined) {
    if (Number(receipt.block_number) === entry.block_number) ok(`block ${entry.block_number}`);
    else fail(`block ${receipt.block_number} differs from ledger block ${entry.block_number}`);
  }

  const feeRaw = receipt.actual_fee?.amount ?? receipt.actual_fee;
  if (feeRaw == null) fail("receipt has no actual_fee");
  if (entry.actual_fee_fri && !sameFelt(feeRaw, entry.actual_fee_fri)) {
    fail(`actual fee ${feeRaw} differs from ledger ${entry.actual_fee_fri}`);
  }
  ok(`actual L2 fee ${formatFri(feeRaw)} (${feeRaw} FRI)`);

  const registryEvents = (receipt.events ?? []).filter(
    (event: any) => event.from_address != null && sameFelt(event.from_address, deployment.registry),
  );
  const adapterEvents = (receipt.events ?? []).filter(
    (event: any) => event.from_address != null
      && adapterAddrs.some((address) => sameFelt(event.from_address, address)),
  );
  if (!expectedEventPresent(entry, registryEvents, adapterEvents)) {
    fail(`missing expected Sole event: ${entry.expected_event ?? "recognized registry or adapter event"}`);
  }
  ok(`contains ${entry.expected_event ?? "a recognized Sole transition"}`);

  const poolEvents = (receipt.events ?? []).filter(
    (event: any) => event.from_address != null && sameFelt(event.from_address, deployment.pool),
  );
  if (entry.pool_deposit_fri == null) {
    if (poolEvents.length === 0) ok("no STRK20 pool event, as recorded for direct registration");
    else fail("unexpected STRK20 pool event in a direct-registration receipt");

    const tx: any = await provider.getTransaction(entry.hash);
    const anonymizerHex = BigInt(deployment.anonymizer).toString(16);
    if (JSON.stringify(tx).toLowerCase().includes(anonymizerHex)) {
      ok("transaction calldata references the configured anonymizer");
    } else {
      fail("direct registration transaction does not reference the configured anonymizer");
    }
    return;
  }

  const deposit = poolEvents.find((event: any) => sameFelt(event.keys?.[0], SEL.Deposit));
  if (!deposit || !sameFelt(deposit.data?.[0], entry.pool_deposit_fri)) {
    fail(`missing expected public pool Deposit of ${entry.pool_deposit_fri}`);
  }
  ok(`public pool Deposit ${formatFri(deposit.data[0])}; depositor is indexed in this receipt`);

  const withdrawal = poolEvents.find((event: any) => sameFelt(event.keys?.[0], SEL.Withdrawal));
  const withdrawalAmount = withdrawal?.data?.[withdrawal.data.length - 1];
  if (!withdrawal || !sameFelt(withdrawalAmount, entry.pool_fee_withdrawal_fri)) {
    fail(`missing expected pool fee withdrawal of ${entry.pool_fee_withdrawal_fri}`);
  }
  ok(`pool fee withdrawal ${formatFri(withdrawalAmount)}`);

  const invoke = poolEvents.find((event: any) =>
    sameFelt(event.keys?.[0], SEL.ExternalContractInvoked)
    && sameFelt(event.keys?.[1], deployment.anonymizer)
    && sameFelt(event.keys?.[2], SEL.PrivacyInvoke),
  );
  if (!invoke) fail("missing ExternalContractInvoked for configured anonymizer privacy_invoke");
  ok("pool invoked the configured anonymizer through privacy_invoke");
  ok("receipt-level public deposit and Sole transition are correlated; wallet unlinkability is not claimed");
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: verify-mainnet.ts <tx_hash> | --all");
    process.exit(2);
  }
  if (arg === "--all") {
    for (const entry of ledger.transactions) await verify(entry);
    console.log(`\nverified ${ledger.transactions.length} ledger transactions from live chain data`);
    return;
  }
  const entry = ledger.transactions.find((candidate) => sameFelt(candidate.hash, arg));
  if (!entry) {
    console.error("hash is not in evidence/claims.json; add expected receipt facts before treating it as evidence");
    process.exit(2);
  }
  await verify(entry);
}

main().catch((error) => { console.error(error); process.exit(1); });

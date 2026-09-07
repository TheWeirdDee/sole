// SPDX-License-Identifier: Apache-2.0
//
// Sole - submit-self-paid-claim
// Submits a REAL duplicate-claim {call, proof} - built by Ready in the
// browser via SoleClient.prepareClaimForSelfPaidSubmission(), no submission
// yet - directly through a plain, non-wallet account. This exists because
// Ready's own paymaster refuses to sponsor a call it predicts will revert:
// a duplicate claim against an already-ACTIVE right is exactly such a call,
// so the sponsored wallet path can never produce this specific evidence.
//
// Two things must both hold for this to actually reach the network instead
// of failing before submission:
//   1. The proof is agnostic to whether the eventual on-chain call
//      reverts - it only proves knowledge of a valid shielded claimant and
//      funding note - so Ready can build it even for a doomed claim.
//   2. Account.execute() estimates its own fee by default, which runs the
//      SAME kind of pre-flight simulation Ready's paymaster does - so this
//      script supplies explicit resourceBounds, which skips that internal
//      estimateFee call entirely (confirmed by reading starknet.js's own
//      prepareInvoke(): `if (!resourceBounds) { ...estimate... }`).
//
// A reverted transaction still costs real gas and still returns a receipt
// with the revert reason - that receipt is the evidence this captures.
//
//   usage: node --experimental-strip-types scripts/submit-self-paid-claim.ts
//   input: scripts/self-paid-claim-input.json - paste the exact JSON logged
//          by the "Debug: build real duplicate-claim proof" button in the
//          live app (Bank B panel) while a right is ACTIVE.
//   env:   STARKNET_RPC        - defaults to a public mainnet endpoint
//          PROBE_PRIVATE_KEY   - funded account's private key (the submitter,
//                                unrelated to the account that built the proof)
//          PROBE_ACCOUNT_ADDR  - funded account's address

import { Account, RpcProvider } from "starknet";
import { readFileSync } from "node:fs";

const RPC = process.env.STARKNET_RPC ?? "https://starknet-rpc.publicnode.com";
const PRIVATE_KEY = process.env.PROBE_PRIVATE_KEY;
const ACCOUNT_ADDR = process.env.PROBE_ACCOUNT_ADDR;

if (!PRIVATE_KEY || !ACCOUNT_ADDR) {
  console.error("set PROBE_PRIVATE_KEY and PROBE_ACCOUNT_ADDR in the environment");
  process.exit(2);
}

const INPUT_PATH = new URL("./self-paid-claim-input.json", import.meta.url);

// Reference bounds: the exact resource_bounds a real, successful finance()
// call needed on mainnet (tx 0x62c80fd0...e8202, fetched via
// provider.getTransaction and confirmed in evidence/claims.json). A
// reverting duplicate claim does comparable proof-verification work before
// failing, so these are scaled up rather than guessed from scratch - low
// enough to be a real signal if something is very wrong, high enough that
// under-provisioning shouldn't be the reason this fails.
const REFERENCE_BOUNDS = {
  l1_gas: { max_amount: 0x0n, max_price_per_unit: 0x705f34cc4692n },
  l2_gas: { max_amount: 0x8df79a5n, max_price_per_unit: 0xa836b7546n },
  l1_data_gas: { max_amount: 0x510n, max_price_per_unit: 0x97feffca9n },
};
const AMOUNT_MULTIPLIER = 2n; // headroom on the resource ceiling itself
const PRICE_MULTIPLIER = 3n; // headroom against price movement since that tx

function toHex(n: bigint): string {
  return "0x" + n.toString(16);
}

function scaledBounds() {
  const scale = (v: { max_amount: bigint; max_price_per_unit: bigint }) => ({
    max_amount: toHex(v.max_amount * AMOUNT_MULTIPLIER),
    max_price_per_unit: toHex(v.max_price_per_unit * PRICE_MULTIPLIER),
  });
  return {
    l1_gas: { max_amount: toHex(REFERENCE_BOUNDS.l1_gas.max_amount), max_price_per_unit: toHex(REFERENCE_BOUNDS.l1_gas.max_price_per_unit * PRICE_MULTIPLIER) },
    l2_gas: scale(REFERENCE_BOUNDS.l2_gas),
    l1_data_gas: scale(REFERENCE_BOUNDS.l1_data_gas),
  };
}

async function main() {
  let input: any;
  try {
    input = JSON.parse(readFileSync(INPUT_PATH, "utf8"));
  } catch (e: any) {
    console.error(`could not read ${INPUT_PATH.pathname}: ${e.message}`);
    console.error("paste the JSON logged by the app's \"Debug: build real duplicate-claim proof\" button into that file first.");
    process.exit(2);
  }
  const { call, proof, reference, claimCommitment } = input;
  if (!call || !proof) {
    console.error("input JSON must contain { call, proof } - see the app log for the exact shape.");
    process.exit(2);
  }

  const provider = new RpcProvider({ nodeUrl: RPC });
  const account = new Account({ provider, address: ACCOUNT_ADDR!, signer: PRIVATE_KEY! });

  console.log(`submitter (plain, no wallet, no paymaster): ${ACCOUNT_ADDR}`);
  console.log(`reference: ${reference ?? "(not included in input)"}`);
  console.log(`claim commitment (Bank B's, expected to lose): ${claimCommitment ?? "(not included in input)"}`);
  console.log(`resource bounds (explicit - skips Account.execute()'s own fee estimation):`);
  const resourceBounds = scaledBounds();
  console.log(JSON.stringify(resourceBounds, null, 2));

  console.log("\nsubmitting (this call reverting is the expected, wanted outcome)...");
  let result: { transaction_hash: string };
  try {
    result = await account.execute(call, {
      proof: proof.data,
      proofFacts: proof.proof_facts,
      resourceBounds,
    });
  } catch (e: any) {
    console.error("\nsubmission itself failed before reaching the network:", e.message ?? e);
    console.error("if this is a fee/resource error, the bounds above were still insufficient - raise the multipliers and retry.");
    process.exit(1);
  }
  console.log(`tx hash: ${result.transaction_hash}`);
  console.log(`https://voyager.online/tx/${result.transaction_hash}`);

  console.log("\nwaiting for the receipt...");
  const receipt: any = await provider.waitForTransaction(result.transaction_hash);
  const status = receipt.execution_status ?? receipt.finality_status;
  console.log(`status: ${status}`);

  if (status === "REVERTED") {
    console.log(`revert reason: ${receipt.revert_reason ?? "(none reported)"}`);
    if (String(receipt.revert_reason ?? "").includes("RIGHT_ALREADY_ACTIVE")) {
      console.log("\nconfirmed: a real, paid mainnet transaction reverted with RIGHT_ALREADY_ACTIVE.");
      console.log("this hash is the live duplicate-claim evidence - add it to evidence/claims.json and strk20.json,");
      console.log(`then verify it independently: node --experimental-strip-types scripts/verify-mainnet.ts ${result.transaction_hash}`);
    } else {
      console.log("\nreverted, but not with RIGHT_ALREADY_ACTIVE - read the reason above before treating this as the intended evidence.");
    }
  } else {
    console.log("\nthis call did NOT revert. That would mean the duplicate claim actually succeeded, which would be a real");
    console.log("exclusivity-invariant failure worth investigating immediately - or the wrong reference/right state was targeted.");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });

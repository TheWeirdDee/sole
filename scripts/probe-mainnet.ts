// SPDX-License-Identifier: Apache-2.0
//
// Sole - probe-mainnet
// Proves one real SoleClient -> mainnet round trip before any UI is wired to
// it: register a throwaway canonical right through @sole/sdk, read the
// result back from the deployed RightsRegistry, and print both.
//
// Scope, stated plainly: this exercises register() only. register() carries
// no value and is never routed through the STRK20 pool's privacy_invoke (see
// IClaimAnonymizer::register) - claim/settle/finance are, via
// WalletAccountV6.strk20InvokeTransaction, which requires a real connected
// wallet extension and cannot be constructed headlessly. Proving that path
// needs a real browser + Ready wallet session, not a script.
//
//   usage: node --experimental-strip-types scripts/probe-mainnet.ts
//   env:   STARKNET_RPC        - defaults to a public mainnet endpoint
//          PROBE_PRIVATE_KEY   - funded account's private key
//          PROBE_ACCOUNT_ADDR  - funded account's address

import { Account, RpcProvider } from "starknet";
import { readFileSync } from "node:fs";
import { SoleClient } from "../packages/sole-sdk/src/index.ts";

const RPC = process.env.STARKNET_RPC ?? "https://rpc.starknet.lava.build";
const PRIVATE_KEY = process.env.PROBE_PRIVATE_KEY;
const ACCOUNT_ADDR = process.env.PROBE_ACCOUNT_ADDR;

if (!PRIVATE_KEY || !ACCOUNT_ADDR) {
  console.error("set PROBE_PRIVATE_KEY and PROBE_ACCOUNT_ADDR in the environment");
  process.exit(2);
}

const deployment = JSON.parse(
  readFileSync(new URL("../evidence/deployment.json", import.meta.url), "utf8"),
);

async function main() {
  const provider = new RpcProvider({ nodeUrl: RPC });
  const account = new Account({ provider, address: ACCOUNT_ADDR!, signer: PRIVATE_KEY! });

  console.log(`account:    ${ACCOUNT_ADDR}`);
  console.log(`registry:   ${deployment.registry}`);
  console.log(`anonymizer: ${deployment.anonymizer}\n`);

  // Fetch the registry ABI live from the deployed class, rather than from a
  // local build artifact, so this probes what's actually on-chain.
  const registryClass: any = await provider.getClassAt(deployment.registry);
  const registryAbi = registryClass.abi;

  const sole = new SoleClient(
    provider,
    { registry: deployment.registry, anonymizer: deployment.anonymizer, pool: deployment.pool, adapter: deployment.adapter_venue_1 },
    registryAbi,
  );

  const reference = `PROBE-${Date.now()}`;
  console.log(`registering canonical right "${reference}" ...`);

  let txHash: string;
  try {
    txHash = await sole.register(account, reference);
  } catch (e: any) {
    console.error("submission failed:", e.message ?? e);
    process.exit(1);
  }
  console.log(`tx hash: ${txHash}`);

  const receipt: any = await provider.waitForTransaction(txHash);
  const status = receipt.execution_status ?? receipt.status ?? "UNKNOWN";
  console.log(`status:  ${status}`);

  if (status === "REVERTED") {
    console.error(`revert reason: ${receipt.revert_reason ?? "(none reported)"}`);
    process.exit(1);
  }

  console.log("\nreading back state_of() from the registry...");
  const view = await sole.publicView(reference);
  console.log(`slot_key: ${view.slotKey}`);
  console.log(`state:    ${view.state}`);

  if (view.state !== "UNCLAIMED") {
    console.error(`expected UNCLAIMED, got ${view.state}`);
    process.exit(1);
  }
  console.log("\nconfirmed: registration landed on-chain and reads back correctly.");
}

main().catch((e) => { console.error(e); process.exit(1); });

"use client";
// Sole - browser wallet + SoleClient wiring.
// Connects to the user's Starknet wallet (Ready) via get-starknet discovery,
// and constructs one SoleClient per venue (finance() targets a fixed adapter
// address per SoleAddresses, so a second venue needs its own client sharing
// the same registry/anonymizer/pool).

import { RpcProvider, WalletAccountV6 } from "starknet";
// createStore() (get-starknet-core >=6, the "next" dist-tag - same pin-past-
// latest gotcha as starknet@^10.4.0 itself) returns wallets already wrapped
// in Wallet Standard shape (.features["standard:connect"], etc.), which is
// what WalletAccountV6.connect() requires. The older getAvailableWallets()/
// enable() pair (get-starknet-core@4.x, resolved by a bare ^4.0.8) returns
// the pre-wallet-standard StarknetWindowObject shape instead - passing that
// into connect() throws "Cannot read properties of undefined (reading
// 'standard:connect')", since it has no .features at all.
import { createStore } from "@starknet-io/get-starknet-core";
import { SoleClient, type SoleAddresses } from "@sole/sdk";

const RPC = process.env.NEXT_PUBLIC_STARKNET_RPC || "https://rpc.starknet.lava.build";

export const ADDRS: SoleAddresses = {
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDR!,
  anonymizer: process.env.NEXT_PUBLIC_ANONYMIZER_ADDR!,
  pool: process.env.NEXT_PUBLIC_POOL_ADDR!,
  adapter: process.env.NEXT_PUBLIC_ADAPTER_ADDR!, // venue 1
};

export const ADAPTER_VENUE_2 = process.env.NEXT_PUBLIC_ADAPTER_VENUE_2_ADDR!;

export const provider = new RpcProvider({ nodeUrl: RPC });

// The registry ABI is fetched live from the deployed class rather than
// bundled, so the client always reflects what's actually on-chain (same
// approach as scripts/probe-mainnet.ts).
let clientsPromise: Promise<{ venue1: SoleClient; venue2: SoleClient }> | null = null;
export function getSoleClients() {
  if (!clientsPromise) {
    clientsPromise = (async () => {
      const cls: any = await provider.getClassAt(ADDRS.registry);
      const abi = cls.abi;
      return {
        venue1: new SoleClient(provider, ADDRS, abi),
        venue2: new SoleClient(provider, { ...ADDRS, adapter: ADAPTER_VENUE_2 }, abi),
      };
    })();
  }
  return clientsPromise;
}

export async function connectWallet(): Promise<WalletAccountV6> {
  const wallets = createStore().getWallets();
  if (wallets.length === 0) {
    throw new Error("No Starknet wallet detected - install Ready (ready.co) and reload.");
  }
  return WalletAccountV6.connect(provider, wallets[0]);
}

/** A fresh felt, browser-native (crypto.getRandomValues), for demo-only
 *  values that aren't specified by the protocol: claimantSecret,
 *  fundingNote, amountCommitment. Kept well under felt252 range. */
export function randomFelt(): string {
  const bytes = new Uint8Array(31); // < 2^248, safely under the felt252 prime
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex;
}

export function voyagerTxUrl(hash: string): string {
  return `https://voyager.online/tx/${hash}`;
}

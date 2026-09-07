"use client";
// Sole - browser wallet + SoleClient wiring.
// Connects to the user's Starknet wallet (Ready) via get-starknet discovery,
// and constructs one SoleClient per configured adapter (finance() targets a
// fixed adapter address per SoleAddresses).

import { compareVersions, Contract, RpcProvider, walletV6, WalletAccountV6 } from "starknet";
// createStore() (get-starknet-core >=6, the "next" dist-tag - same pin-past-
// latest gotcha as starknet@^10.4.0 itself) returns wallets already wrapped
// in Wallet Standard shape (.features["standard:connect"], etc.), which is
// what WalletAccountV6.connect() requires. The older getAvailableWallets()/
// enable() pair (get-starknet-core@4.x, resolved by a bare ^4.0.8) returns
// the pre-wallet-standard StarknetWindowObject shape instead - passing that
// into connect() throws "Cannot read properties of undefined (reading
// 'standard:connect')", since it has no .features at all.
import { createStore } from "@starknet-io/get-starknet-core";
import { SoleClient, type SoleAddresses, withTimeout } from "@sole/sdk";

// `createStore()` installs wallet-discovery listeners. Creating a fresh store
// on every Connect click (and every Fast Refresh) accumulates listeners inside
// extension bridges, producing the MaxListeners/orphaned-liveness warnings
// seen with Ready. Keep exactly one browser-global discovery store instead.
type WalletDiscoveryStore = ReturnType<typeof createStore>;
function getWalletDiscoveryStore(): WalletDiscoveryStore {
  const root = globalThis as typeof globalThis & {
    __soleWalletDiscoveryStore__?: WalletDiscoveryStore;
  };
  return (root.__soleWalletDiscoveryStore__ ??= createStore());
}

// Lava's public Starknet endpoint now returns HTTP 410. Keep the environment
// override for production providers, but use a current public endpoint for a
// fresh local checkout so reads/receipt reconciliation do not fail first.
const RPC = process.env.NEXT_PUBLIC_STARKNET_RPC || "https://starknet-rpc.publicnode.com";

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

// A second-adapter refusal is only a cross-venue result when it is a distinct
// adapter, shares the registry, and reports a venue address of its own. Read
// all three configuration facts before describing it that way. This is a
// public RPC call, never a wallet request. Cache success, but allow a transient
// RPC failure to be retried by the next explicit check.
export type SecondAdapterConfiguration = {
  isDistinctAdapter: boolean;
  sharesRegistry: boolean;
  reportsOwnVenue: boolean;
};

let secondAdapterConfigurationPromise: Promise<SecondAdapterConfiguration> | null = null;
export async function secondAdapterConfiguration(): Promise<SecondAdapterConfiguration> {
  if (!secondAdapterConfigurationPromise) {
    secondAdapterConfigurationPromise = (async () => {
      const cls: any = await provider.getClassAt(ADAPTER_VENUE_2);
      const adapter = new Contract({
        abi: cls.abi, address: ADAPTER_VENUE_2, providerOrAccount: provider,
      });
      const [configuredRegistry, configuredVenue] = await Promise.all([
        adapter.registry(), adapter.venue(),
      ]);
      return {
        isDistinctAdapter: BigInt(ADAPTER_VENUE_2) !== BigInt(ADDRS.adapter),
        sharesRegistry: BigInt(configuredRegistry.toString()) === BigInt(ADDRS.registry),
        reportsOwnVenue: BigInt(configuredVenue.toString()) === BigInt(ADAPTER_VENUE_2),
      };
    })();
  }
  try {
    return await secondAdapterConfigurationPromise;
  } catch (error) {
    secondAdapterConfigurationPromise = null;
    throw error;
  }
}

export async function connectWallet(): Promise<WalletAccountV6> {
  const wallets = getWalletDiscoveryStore().getWallets();
  if (wallets.length === 0) {
    throw new Error("No Starknet wallet detected - install Ready (ready.co) and reload.");
  }

  // Never select `wallets[0]` blindly: browser extensions can expose several
  // wallets, and only a wallet that advertises the STRK20 Wallet API can prove
  // this flow. This capability request is metadata-only; it does not ask for
  // balances, a viewing key, or a signature.
  const readyFirst = [...wallets].sort((a: any, b: any) => {
    const aReady = /ready/i.test(String(a?.name ?? ""));
    const bReady = /ready/i.test(String(b?.name ?? ""));
    return Number(bReady) - Number(aReady);
  });
  for (const wallet of readyFirst) {
    try {
      const versions = await withTimeout(
        walletV6.supportedWalletApi(wallet), 10_000,
        "wallet did not answer its STRK20 capability check",
      );
      if (versions.some((version) => compareVersions(String(version), "0.10.3") >= 0)) {
        return WalletAccountV6.connect(provider, wallet);
      }
    } catch {
      // Try the next discovered wallet. The actionable error below avoids a
      // privacy invoke that would otherwise hang or fail obscurely.
    }
  }
  throw new Error(
    "No detected wallet advertises STRK20 Wallet API >= 0.10.3. Open or update Ready, then reconnect.",
  );
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

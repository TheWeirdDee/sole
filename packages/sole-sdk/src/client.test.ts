// SPDX-License-Identifier: Apache-2.0
//
// Regression test for a real production bug: the Wallet API's FELT type is
// spec'd as ^0x(0|[a-fA-F1-9]{1}[a-fA-F0-9]{0,62})$ - no leading zero digits.
// sncast/explorer-style addresses (how every deployed address in this repo
// is recorded) are zero-padded, e.g. "0x0788f8...". Sending one as-is inside
// a strk20InvokeTransaction payload gets the whole call rejected with
// INVALID_REQUEST_PAYLOAD before it ever reaches the wallet's proving step -
// discovered only once a real wallet exercised claim()/finance(), since
// register() takes the more lenient account.execute() path instead.

import test from "node:test";
import assert from "node:assert/strict";
import { hash } from "starknet";
import {
  decodeRightState, hasExactRightClaim, hasExactRightRegistration, normalizeFelt, ReadySubmissionTimeoutError,
  ReadyPrivateBalanceRequiredError, ReadyStandaloneInvokeRejectedError, RightState, SoleClient,
  waitForReadySubmission, withTimeout,
} from "./client.ts";

const WALLET_API_FELT = /^0x(0|[a-fA-F1-9]{1}[a-fA-F0-9]{0,62})$/;

const TEST_ADDRESSES = {
  registry: "0x1", anonymizer: "0x2", pool: "0x3", adapter: "0x4",
};

function testClient() {
  return new SoleClient({} as any, TEST_ADDRESSES, []);
}

test("normalizeFelt strips leading zero digits from a padded address", () => {
  assert.equal(
    normalizeFelt("0x0788f8439042f8750ec90638bc764dd36f766930770238c630df70e667e6cf28"),
    "0x788f8439042f8750ec90638bc764dd36f766930770238c630df70e667e6cf28",
  );
});

test("normalizeFelt output always matches the Wallet API's strict FELT pattern", () => {
  const addresses = [
    "0x057a4c75612430dae3a79485c41a53f986c42526df59af4f73485cde56be6f4c",
    "0x01ddb10db13096b973a9a63d02f5e9a6370d3b592cd6ca02a91f5729ca685c74",
    "0x0368203c991cfcc239560bbfe2dfa52a84bbf950f0603010229180d08341aae5",
    "0x0788f8439042f8750ec90638bc764dd36f766930770238c630df70e667e6cf28",
    "0x01dbf93d533f9b1d4aff959cfd10cd53136663db81f101d74db8008825b6d27c",
  ];
  for (const addr of addresses) {
    assert.match(normalizeFelt(addr), WALLET_API_FELT, `${addr} did not normalize to a valid FELT`);
  }
});

test("normalizeFelt leaves an already-normalized value alone", () => {
  assert.equal(normalizeFelt("0x1a98f08ac13c2fa57e35f2de5ac9acc98bc9b531932b09c910a90baecf4aad2"),
    "0x1a98f08ac13c2fa57e35f2de5ac9acc98bc9b531932b09c910a90baecf4aad2");
});

test("normalizeFelt maps zero to the bare 0x0 the pattern requires", () => {
  assert.equal(normalizeFelt("0x0"), "0x0");
  assert.equal(normalizeFelt("0x00000"), "0x0");
});

test("withTimeout bounds a wallet bridge promise that never settles", async () => {
  await assert.rejects(
    withTimeout(new Promise<never>(() => {}), 5, "wallet bridge timed out"),
    /wallet bridge timed out/,
  );
});

test("waitForReadySubmission preserves a late wallet hash after its UI deadline", async () => {
  let resolveSubmission!: (value: { transaction_hash: string }) => void;
  const submission = new Promise<{ transaction_hash: string }>((resolve) => { resolveSubmission = resolve; });
  let timeout: unknown;
  try {
    await waitForReadySubmission(submission, 5);
  } catch (error) {
    timeout = error;
  }

  assert.ok(timeout instanceof ReadySubmissionTimeoutError);
  const submissionTimeout = timeout as ReadySubmissionTimeoutError;
  assert.equal(submissionTimeout.outcomeUnknown, true);
  resolveSubmission({ transaction_hash: "0xabc" });
  assert.deepEqual(await submissionTimeout.lateSubmission, { transaction_hash: "0xabc" });
});

test("decodeRightState handles starknet.js CairoCustomEnum results", () => {
  assert.equal(decodeRightState({
    variant: { Unclaimed: undefined, Active: {}, Consumed: undefined },
  }), RightState.Active);
  assert.equal(decodeRightState({
    variant: { Unclaimed: undefined, Active: undefined, Consumed: {} },
  }), RightState.Consumed);
  assert.equal(decodeRightState({
    variant: { Unclaimed: {}, Active: undefined, Consumed: undefined },
  }), RightState.Unclaimed);
  assert.equal(decodeRightState(1n), RightState.Active);
});

test("hasExactRightClaim accepts only the requested registry transition", () => {
  const registry = "0x57";
  const slotKey = "0xa";
  const commitment = "0xb";
  const receipt = {
    events: [{
      from_address: registry,
      keys: [hash.getSelectorFromName("RightClaimed"), slotKey],
      data: [commitment],
    }],
  };

  assert.equal(hasExactRightClaim(receipt, registry, slotKey, commitment), true);
  assert.equal(hasExactRightClaim(receipt, "0x58", slotKey, commitment), false);
  assert.equal(hasExactRightClaim(receipt, registry, "0xc", commitment), false);
  assert.equal(hasExactRightClaim(receipt, registry, slotKey, "0xc"), false);
  assert.equal(hasExactRightClaim({
    events: [{ ...receipt.events[0], keys: [hash.getSelectorFromName("RightRegistered"), slotKey] }],
  }, registry, slotKey, commitment), false);
});

test("hasExactRightRegistration distinguishes a registered slot from an unclaimed default", () => {
  const registry = "0x57";
  const slotKey = "0xa";
  const receipt = {
    events: [{
      from_address: registry,
      keys: [hash.getSelectorFromName("RightRegistered"), slotKey],
      data: [],
    }],
  };

  assert.equal(hasExactRightRegistration(receipt, registry, slotKey), true);
  assert.equal(hasExactRightRegistration(receipt, registry, "0xb"), false);
  assert.equal(hasExactRightRegistration({
    events: [{ ...receipt.events[0], keys: [hash.getSelectorFromName("RightClaimed"), slotKey] }],
  }, registry, slotKey), false);
});

test("dry-run builds a single standalone invoke unless a caller explicitly opts into compatibility", async () => {
  const defaultClient = testClient();
  let defaultActions: any;
  const defaultAccount = {
    strk20PrepareInvoke: async (actions: any) => {
      defaultActions = actions;
      return { call: "prepared" };
    },
  } as any;
  await defaultClient.dryRunClaim(defaultAccount, "RCV-test", "0x5", "0x6");
  assert.equal(defaultActions.length, 1);
  assert.equal(defaultActions[0].type, "invoke");
  assert.equal(defaultActions[0].contract, "0x2");

  const compatibilityClient = testClient();
  // Keep the test focused on action selection rather than a real RPC fee
  // read; the production method itself fetches that amount live.
  (compatibilityClient as any).privacyActionDeposit = async () => "0xc";
  let compatibilityActions: any;
  const compatibilityAccount = {
    strk20PrepareInvoke: async (actions: any) => {
      compatibilityActions = actions;
      return { call: "prepared" };
    },
  } as any;
  await compatibilityClient.dryRunClaim(
    compatibilityAccount, "RCV-test", "0x5", "0x6", { useCompanionDeposit: true },
  );
  assert.equal(compatibilityActions.length, 2);
  assert.equal(compatibilityActions[0].type, "deposit");
  assert.equal(compatibilityActions[0].amount, "0xc");
  assert.equal(compatibilityActions[1].type, "invoke");
});

test("a code-114 standalone preparation is no-submission, not proof a deposit is required", async () => {
  const account = {
    strk20PrepareInvoke: async () => { throw { code: 114, data: { source: "wallet" } }; },
  } as any;
  await assert.rejects(
    testClient().dryRunClaim(account, "RCV-test", "0x5", "0x6"),
    (error: any) => error instanceof ReadyStandaloneInvokeRejectedError
      && error.noSubmission === true
      && error.mayUseCompanionDeposit === true
      && error.code === 114,
  );
});

test("a code-119 preparation is a no-submission shielded-balance result", async () => {
  const account = {
    strk20PrepareInvoke: async () => { throw { code: 119, data: { source: "wallet" } }; },
  } as any;
  await assert.rejects(
    testClient().dryRunClaim(account, "RCV-test", "0x5", "0x6"),
    (error: any) => error instanceof ReadyPrivateBalanceRequiredError
      && error.noSubmission === true
      && error.requiresPrivateBalance === true
      && error.code === 119,
  );
});

test("a real wallet-call error with no hash remains ambiguous", async () => {
  const account = {
    strk20PrepareInvoke: async () => ({ call: "prepared" }),
    strk20InvokeTransaction: async () => { throw { code: 114, data: { source: "wallet" } }; },
  } as any;
  await assert.rejects(
    testClient().claim(account, "RCV-test", "0x5", "0x6"),
    (error: any) => error.code === 114 && error.noSubmission !== true,
  );
});

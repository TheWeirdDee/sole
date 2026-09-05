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
import { normalizeFelt } from "./client.ts";

const WALLET_API_FELT = /^0x(0|[a-fA-F1-9]{1}[a-fA-F0-9]{0,62})$/;

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

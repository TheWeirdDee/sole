// SPDX-License-Identifier: Apache-2.0
//
// Sole - shared-registry adapter gating tests
// Proves a source-level gate: this fallback adapter records a position ONLY
// when Sole says the right is ACTIVE, and only with an auth nonce that matches
// the on-chain claim commitment for that slot - not merely any unused felt.
//
//   A claims -> ACTIVE -> finance() records position -> settle() clears position
//   B's unclaimed path -> finance() reverts
//   after CONSUMED -> finance() reverts
//   a tampered nonce, or recording the same ACTIVE right twice -> both refused
//
// This harness deploys two fallback-adapter instances against one registry. It
// is not evidence that a deployed second adapter is an independently configured
// venue, nor that finance()/settle() transfer value or repay a loan.

use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address};
use starknet::ContractAddress;
use core::poseidon::poseidon_hash_span;
use sole_contracts::rights_registry::{IRightsRegistryDispatcher, IRightsRegistryDispatcherTrait};
use sole_contracts::execution_adapter::{
    IExecutionAdapterDispatcher, IExecutionAdapterDispatcherTrait, ExecAuth, ExecTags,
};

fn ANON() -> ContractAddress { 'anonymizer'.try_into().unwrap() }
fn DEPLOYER() -> ContractAddress { 'deployer'.try_into().unwrap() }

fn deploy() -> (IRightsRegistryDispatcher, IExecutionAdapterDispatcher) {
    let reg_c = declare("RightsRegistry").unwrap().contract_class();
    let (reg_addr, _) = reg_c.deploy(@array![DEPLOYER().into()]).unwrap();
    let reg = IRightsRegistryDispatcher { contract_address: reg_addr };
    start_cheat_caller_address(reg.contract_address, DEPLOYER());
    reg.initialize_anonymizer(ANON());
    stop_cheat_caller_address(reg.contract_address);
    let mkt_c = declare("FallbackMarket").unwrap().contract_class();
    let (mkt_addr, _) = mkt_c.deploy(@array![reg_addr.into(), ANON().into()]).unwrap();
    (reg, IExecutionAdapterDispatcher { contract_address: mkt_addr })
}

// The only valid nonce for (slot_key, commitment) - mirrors the adapter's own
// gate() and the SDK's deriveExecNonce. A test that used an arbitrary felt
// here would no longer prove anything: the adapter now recomputes and checks
// this exact value rather than trusting the caller's auth.
fn real_auth(slot_key: felt252, commitment: felt252) -> ExecAuth {
    ExecAuth { slot_key, nonce: poseidon_hash_span([ExecTags::TAG_EXEC, slot_key, commitment].span()) }
}

const SLOT: felt252 = 0x5107;
const COMMIT_A: felt252 = 0xC1A;
const NULL_A: felt252 = 0x0A;
const AMT: felt252 = 0xA33;

#[test]
fn venue_executes_only_when_authorized() {
    let (reg, mkt) = deploy();
    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);            // A -> ACTIVE
    stop_cheat_caller_address(reg.contract_address);

    // The fallback adapter records a position, gated by Sole's ACTIVE state.
    start_cheat_caller_address(mkt.contract_address, ANON());
    let auth = real_auth(SLOT, COMMIT_A);
    let pos = mkt.finance(auth, AMT);
    assert(pos == AMT, 'position recorded');
    stop_cheat_caller_address(mkt.contract_address);
}

#[test]
#[should_panic(expected: 'AUTH_RIGHT_NOT_ACTIVE')]
fn venue_never_executes_without_active_right() {
    let (reg, mkt) = deploy();
    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);             // registered but NOT claimed (or B's reverted path)
    stop_cheat_caller_address(reg.contract_address);

    start_cheat_caller_address(mkt.contract_address, ANON());
    // Never claimed, so the registry never recorded a commitment for this
    // slot; any nonce - even the one that would be correct once claimed -
    // fails the ACTIVE check first.
    let auth = real_auth(SLOT, 0);
    // (shared-registry adapter, non-ACTIVE) --finance--> REVERT AUTH_RIGHT_NOT_ACTIVE
    mkt.finance(auth, AMT);
}

#[test]
#[should_panic(expected: 'AUTH_NONCE_MISMATCH')]
fn venue_rejects_a_tampered_nonce() {
    // The vulnerability this closes: auth.nonce must be independently
    // recomputed from the registry's own commitment, never trusted from
    // calldata. An attacker who guesses (or is handed) an ACTIVE slot_key
    // cannot record a position with a made-up nonce.
    let (reg, mkt) = deploy();
    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);
    stop_cheat_caller_address(reg.contract_address);

    start_cheat_caller_address(mkt.contract_address, ANON());
    let forged = ExecAuth { slot_key: SLOT, nonce: 0xdead };
    mkt.finance(forged, AMT);
}

#[test]
#[should_panic(expected: 'RIGHT_ALREADY_FINANCED')]
fn venue_refuses_to_finance_the_same_active_right_twice() {
    // The other half of the same vulnerability: even with the correct,
    // properly-derived auth, a position can be recorded at most once while
    // ACTIVE. The fallback position is tracked per slot_key, not per nonce.
    let (reg, mkt) = deploy();
    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);
    stop_cheat_caller_address(reg.contract_address);

    start_cheat_caller_address(mkt.contract_address, ANON());
    let auth = real_auth(SLOT, COMMIT_A);
    mkt.finance(auth, AMT);
    mkt.finance(auth, AMT); // same right, still ACTIVE -> refused
}

#[test]
#[should_panic(expected: 'AUTH_RIGHT_NOT_ACTIVE')]
fn venue_refuses_after_consumption() {
    let (reg, mkt) = deploy();
    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);
    stop_cheat_caller_address(reg.contract_address);

    start_cheat_caller_address(mkt.contract_address, ANON());
    let auth = real_auth(SLOT, COMMIT_A);
    mkt.finance(auth, AMT);
    mkt.settle(auth);                    // clear fallback position
    stop_cheat_caller_address(mkt.contract_address);

    start_cheat_caller_address(reg.contract_address, ANON());
    reg.settle(SLOT, NULL_A);           // right -> CONSUMED
    stop_cheat_caller_address(reg.contract_address);

    start_cheat_caller_address(mkt.contract_address, ANON());
    // (shared-registry adapter, non-ACTIVE) --finance--> REVERT AUTH_RIGHT_NOT_ACTIVE
    mkt.finance(auth, AMT);
}

// Shared-registry adapter test: a consumed right cannot have a fallback
// position recorded by another adapter instance in this harness. This is the
// source/test form of the generic gate below, not a deployed independent-venue
// assertion or a wallet-privacy assertion.
// (shared-registry adapter, non-ACTIVE) --finance--> REVERT AUTH_RIGHT_NOT_ACTIVE
#[test]
#[should_panic(expected: 'AUTH_RIGHT_NOT_ACTIVE')]
fn second_venue_refuses_a_consumed_right() {
    let reg_c = declare("RightsRegistry").unwrap().contract_class();
    let (reg_addr, _) = reg_c.deploy(@array![DEPLOYER().into()]).unwrap();
    let reg = IRightsRegistryDispatcher { contract_address: reg_addr };
    start_cheat_caller_address(reg.contract_address, DEPLOYER());
    reg.initialize_anonymizer(ANON());
    stop_cheat_caller_address(reg.contract_address);
    let mkt_c = declare("FallbackMarket").unwrap().contract_class();
    let (mkt1_addr, _) = mkt_c.deploy(@array![reg_addr.into(), ANON().into()]).unwrap();
    let (mkt2_addr, _) = mkt_c.deploy(@array![reg_addr.into(), ANON().into()]).unwrap(); // second test adapter
    let mkt1 = IExecutionAdapterDispatcher { contract_address: mkt1_addr };
    let mkt2 = IExecutionAdapterDispatcher { contract_address: mkt2_addr };

    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);
    stop_cheat_caller_address(reg.contract_address);

    let auth = real_auth(SLOT, COMMIT_A);
    start_cheat_caller_address(mkt1.contract_address, ANON());
    mkt1.finance(auth, AMT);          // fallback position recorded on adapter 1
    mkt1.settle(auth);
    stop_cheat_caller_address(mkt1.contract_address);

    start_cheat_caller_address(reg.contract_address, ANON());
    reg.settle(SLOT, NULL_A);         // right CONSUMED, globally
    stop_cheat_caller_address(reg.contract_address);

    // A distinct adapter instance in the test harness sees a consumed right.
    start_cheat_caller_address(mkt2.contract_address, ANON());
    mkt2.finance(auth, AMT);          // reverts -> AUTH_RIGHT_NOT_ACTIVE
}

// SPDX-License-Identifier: Apache-2.0
//
// Sole - exclusivity invariant tests
// Every test maps to a claim Sole makes in the README. A test that fails for
// the wrong reason is a failure: each adversarial case asserts the EXACT panic
// it must produce (snforge #[should_panic(expected: ...)]).
//
//   PASS CASES                          ADVERSARIAL CASES (must revert)
//   register -> UNCLAIMED               second register            -> ALREADY_REGISTERED
//   claim    -> ACTIVE                  second claim (double-fund) -> ALREADY_ACTIVE   <-- the thesis
//   settle   -> CONSUMED                claim before register      -> NOT_REGISTERED
//   re-register new right -> UNCLAIMED  settle when not active      -> NOT_ACTIVE
//                                       replay settle (same null)   -> NULLIFIER_SPENT
//                                       claim after consumed        -> ALREADY_ACTIVE
//                                       zero commitment             -> ZERO_COMMITMENT
//                                       non-anonymizer caller       -> CALLER_NOT_ANONYMIZER

use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address};
use starknet::{ContractAddress, contract_address_const};
use sole_contracts::rights_registry::{
    IRightsRegistryDispatcher, IRightsRegistryDispatcherTrait, RightState,
};

fn ANON() -> ContractAddress { contract_address_const::<'anonymizer'>() }
fn STRANGER() -> ContractAddress { contract_address_const::<'stranger'>() }

fn deploy() -> IRightsRegistryDispatcher {
    let contract = declare("RightsRegistry").unwrap().contract_class();
    let (addr, _) = contract.deploy(@array![ANON().into()]).unwrap();
    IRightsRegistryDispatcher { contract_address: addr }
}

// slot_key and commitment values here stand in for the SDK-derived Poseidon
// outputs; the registry treats them as opaque felts, which is the point.
const SLOT_A: felt252 = 0x5107;   // canonical right "A"
const SLOT_B: felt252 = 0x5108;   // canonical right "B"
const COMMIT_A: felt252 = 0xC1A;  // Bank A's private claim commitment
const COMMIT_B: felt252 = 0xC1B;  // Bank B's private claim commitment
const NULL_A: felt252 = 0x0A;     // Bank A's nullifier

// ---------- happy path ----------

#[test]
fn full_lifecycle_unclaimed_active_consumed() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    assert(r.state_of(SLOT_A) == RightState::Unclaimed, 'expected UNCLAIMED');
    r.claim(SLOT_A, COMMIT_A);
    assert(r.state_of(SLOT_A) == RightState::Active, 'expected ACTIVE');
    assert(r.commitment_of(SLOT_A) == COMMIT_A, 'commitment recorded');
    r.settle(SLOT_A, NULL_A);
    assert(r.state_of(SLOT_A) == RightState::Consumed, 'expected CONSUMED');
    assert(r.commitment_of(SLOT_A) == 0, 'commitment cleared');
    assert(r.is_nullifier_spent(NULL_A), 'nullifier burned');
    stop_cheat_caller_address(r.contract_address);
}

#[test]
fn independent_rights_do_not_interfere() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.register_right(SLOT_B);
    r.claim(SLOT_A, COMMIT_A);
    // B is a different canonical right; claiming A must not affect it.
    assert(r.state_of(SLOT_B) == RightState::Unclaimed, 'B still unclaimed');
    r.claim(SLOT_B, COMMIT_B);
    assert(r.state_of(SLOT_B) == RightState::Active, 'B now active');
    stop_cheat_caller_address(r.contract_address);
}

// ---------- the thesis: double-claim rejected ----------

#[test]
#[should_panic(expected: 'RIGHT_ALREADY_ACTIVE')]
fn second_claim_on_active_right_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.claim(SLOT_A, COMMIT_A);        // Bank A acquires the right
    r.claim(SLOT_A, COMMIT_B);        // Bank B tries the same right -> REVERT
}

#[test]
#[should_panic(expected: 'RIGHT_ALREADY_ACTIVE')]
fn claim_after_consumption_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.claim(SLOT_A, COMMIT_A);
    r.settle(SLOT_A, NULL_A);
    r.claim(SLOT_A, COMMIT_B);        // consumed right cannot be re-claimed
}

// ---------- other adversarial cases ----------

#[test]
#[should_panic(expected: 'RIGHT_ALREADY_REGISTERED')]
fn second_registration_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.register_right(SLOT_A);
}

#[test]
#[should_panic(expected: 'RIGHT_NOT_REGISTERED')]
fn claim_before_registration_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.claim(SLOT_A, COMMIT_A);
}

#[test]
#[should_panic(expected: 'RIGHT_NOT_ACTIVE')]
fn settle_when_not_active_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.settle(SLOT_A, NULL_A);         // never claimed
}

#[test]
#[should_panic(expected: 'NULLIFIER_ALREADY_SPENT')]
fn replayed_settlement_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.claim(SLOT_A, COMMIT_A);
    r.settle(SLOT_A, NULL_A);
    // re-register + re-claim a fresh slot, then replay the SAME nullifier
    r.register_right(SLOT_B);
    r.claim(SLOT_B, COMMIT_B);
    r.settle(SLOT_B, NULL_A);         // reused nullifier -> REVERT
}

#[test]
#[should_panic(expected: 'ZERO_COMMITMENT')]
fn zero_commitment_reverts() {
    let r = deploy();
    start_cheat_caller_address(r.contract_address, ANON());
    r.register_right(SLOT_A);
    r.claim(SLOT_A, 0);
}

#[test]
#[should_panic(expected: 'CALLER_NOT_ANONYMIZER')]
fn direct_registry_call_reverts() {
    let r = deploy();
    // A raw wallet tries to drive the registry directly, bypassing the
    // anonymizer boundary. Rejected: transitions must go through the
    // privacy path or the claimant identity would leak.
    start_cheat_caller_address(r.contract_address, STRANGER());
    r.register_right(SLOT_A);
}

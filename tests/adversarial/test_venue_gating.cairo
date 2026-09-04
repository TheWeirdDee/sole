// SPDX-License-Identifier: Apache-2.0
//
// Sole - venue gating tests
// Proves the causal claim: the money market executes ONLY when Sole says the
// right is ACTIVE. Bank B's duplicate claim reverts at Sole, so no auth exists
// and finance() can never run for B.
//
//   A claims -> ACTIVE -> finance() succeeds -> settle repays + consumes
//   B claims same right -> REVERT at Sole -> B never obtains ACTIVE -> finance() reverts
//   after CONSUMED -> finance() reverts

use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address};
use starknet::{ContractAddress, contract_address_const};
use sole_contracts::rights_registry::{IRightsRegistryDispatcher, IRightsRegistryDispatcherTrait};
use sole_contracts::execution_adapter::{
    IExecutionAdapterDispatcher, IExecutionAdapterDispatcherTrait, ExecAuth,
};

fn ANON() -> ContractAddress { contract_address_const::<'anonymizer'>() }

fn deploy() -> (IRightsRegistryDispatcher, IExecutionAdapterDispatcher) {
    let reg_c = declare("RightsRegistry").unwrap().contract_class();
    let (reg_addr, _) = reg_c.deploy(@array![ANON().into()]).unwrap();
    let mkt_c = declare("FallbackMarket").unwrap().contract_class();
    let (mkt_addr, _) = mkt_c.deploy(@array![reg_addr.into(), ANON().into()]).unwrap();
    (
        IRightsRegistryDispatcher { contract_address: reg_addr },
        IExecutionAdapterDispatcher { contract_address: mkt_addr },
    )
}

const SLOT: felt252 = 0x5107;
const COMMIT_A: felt252 = 0xC1A;
const NULL_A: felt252 = 0x0A;
const NONCE_A: felt252 = 0xE0;
const AMT: felt252 = 0xA33;

#[test]
fn venue_executes_only_when_authorized() {
    let (reg, mkt) = deploy();
    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);            // A -> ACTIVE
    stop_cheat_caller_address(reg.contract_address);

    // financing runs against the venue, gated by Sole's ACTIVE state
    start_cheat_caller_address(mkt.contract_address, ANON());
    let auth = ExecAuth { slot_key: SLOT, nonce: NONCE_A };
    let pos = mkt.finance(auth, AMT);
    assert(pos == AMT, 'financed against venue');
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
    let auth = ExecAuth { slot_key: SLOT, nonce: NONCE_A };
    mkt.finance(auth, AMT);              // no ACTIVE right -> venue refuses
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
    let auth = ExecAuth { slot_key: SLOT, nonce: NONCE_A };
    mkt.finance(auth, AMT);
    mkt.settle(auth);                    // repay + release
    stop_cheat_caller_address(mkt.contract_address);

    start_cheat_caller_address(reg.contract_address, ANON());
    reg.settle(SLOT, NULL_A);           // right -> CONSUMED
    stop_cheat_caller_address(reg.contract_address);

    start_cheat_caller_address(mkt.contract_address, ANON());
    mkt.finance(auth, AMT);             // consumed right -> venue refuses
}

// Cross-venue single-use: a right consumed once cannot be financed again at a
// DIFFERENT venue. Two independent adapters, same registry. Neither the second
// venue nor its future lender learns who financed first - they learn only that
// the right is spent. This is the guarantee a per-settlement rollback cannot
// give: consumption is global to the right, not local to one market.
#[test]
#[should_panic(expected: 'AUTH_RIGHT_NOT_ACTIVE')]
fn second_venue_refuses_a_consumed_right() {
    let reg_c = declare("RightsRegistry").unwrap().contract_class();
    let (reg_addr, _) = reg_c.deploy(@array![ANON().into()]).unwrap();
    let mkt_c = declare("FallbackMarket").unwrap().contract_class();
    let (mkt1_addr, _) = mkt_c.deploy(@array![reg_addr.into(), ANON().into()]).unwrap();
    let (mkt2_addr, _) = mkt_c.deploy(@array![reg_addr.into(), ANON().into()]).unwrap(); // second venue
    let reg = IRightsRegistryDispatcher { contract_address: reg_addr };
    let mkt1 = IExecutionAdapterDispatcher { contract_address: mkt1_addr };
    let mkt2 = IExecutionAdapterDispatcher { contract_address: mkt2_addr };

    start_cheat_caller_address(reg.contract_address, ANON());
    reg.register_right(SLOT);
    reg.claim(SLOT, COMMIT_A);
    stop_cheat_caller_address(reg.contract_address);

    let auth = ExecAuth { slot_key: SLOT, nonce: NONCE_A };
    start_cheat_caller_address(mkt1.contract_address, ANON());
    mkt1.finance(auth, AMT);          // financed at venue 1
    mkt1.settle(auth);
    stop_cheat_caller_address(mkt1.contract_address);

    start_cheat_caller_address(reg.contract_address, ANON());
    reg.settle(SLOT, NULL_A);         // right CONSUMED, globally
    stop_cheat_caller_address(reg.contract_address);

    // A different venue, a different lender, later. The right is spent.
    start_cheat_caller_address(mkt2.contract_address, ANON());
    mkt2.finance(auth, AMT);          // venue 2 refuses -> AUTH_RIGHT_NOT_ACTIVE
}

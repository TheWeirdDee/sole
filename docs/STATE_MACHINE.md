# State Machine

## Shipped (MVP)
```
        register_right()
   ( - ) ───────────────▶ UNCLAIMED
                              │ claim(commitment)          [assert UNCLAIMED]
                              ▼
                            ACTIVE
                              │ settle(nullifier)          [assert ACTIVE, nullifier fresh]
                              ▼
                           CONSUMED   (terminal)
```

Forbidden transitions (each asserted, each tested):
```
UNCLAIMED --register--> REVERT RIGHT_ALREADY_REGISTERED
ACTIVE    --claim-->    REVERT RIGHT_ALREADY_ACTIVE      <-- the thesis
CONSUMED  --claim-->    REVERT RIGHT_ALREADY_ACTIVE
UNCLAIMED --settle-->   REVERT RIGHT_NOT_ACTIVE
(replay)  --settle-->   REVERT NULLIFIER_ALREADY_SPENT
(anyone but anonymizer) REVERT CALLER_NOT_ANONYMIZER
```

## Documented, not shipped (roadmap — DECISIONS D-007 keeps the demo to one path)
```
ACTIVE --expire()--> EXPIRED          (deadline passes without settlement)
ACTIVE --cancel()--> CANCELLED        (holder aborts; frees the slot)
ACTIVE --partial()--> PARTIALLY_SETTLED --settle()--> CONSUMED
```
These are interface stubs and specification only; they are not implemented
before the core is proven on mainnet. Shipping three clean states beats six
half-working ones.

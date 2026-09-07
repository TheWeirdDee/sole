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
(same consumed slot) --settle--> REVERT RIGHT_NOT_ACTIVE
(reused nullifier on another ACTIVE slot) --> REVERT NULLIFIER_ALREADY_SPENT
(anyone but anonymizer) REVERT CALLER_NOT_ANONYMIZER
(shared-registry adapter, non-ACTIVE) --finance--> REVERT AUTH_RIGHT_NOT_ACTIVE
```

The last line is a source-and-test property of an adapter configured with the
same registry. It is not a recorded mainnet cross-venue rejection, and the
currently deployed second adapter does not prove an independent venue
configuration. See [`EVIDENCE_LEDGER.md`](./EVIDENCE_LEDGER.md).

## Documented, not shipped (roadmap — DECISIONS D-007 keeps the demo to one path)
```
ACTIVE --expire()--> EXPIRED          (deadline passes without settlement)
ACTIVE --cancel()--> CANCELLED        (holder aborts; frees the slot)
ACTIVE --partial()--> PARTIALLY_SETTLED --settle()--> CONSUMED
```
These are interface stubs and specification only; they are not implemented
before the core is proven on mainnet. Shipping three clean states beats six
half-working ones.

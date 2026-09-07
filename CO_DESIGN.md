# Co-design & Operational Analysis

Sole's demo vertical (duplicate invoice financing) is grounded in a real operational problem in trade credit and receivable discounting.

## The Operational Problem
In trade finance and SME invoice discounting, duplicate financing (double-pledging the same receivable to multiple factoring houses) accounts for significant credit losses globally. Lenders currently have no trust-minimized mechanism to verify whether an asset has already been pledged to another factoring house.

Today, this is handled through manual phone checks, bilateral confirmations, or court filings. Centralized public registries fail in practice because financial institutions fiercely protect their loan books—no bank wants competing lenders to see which clients they are funding, the discount margins, or transaction volumes. Consequently, duplicate pledging remains an unhedged fraud risk that banks price directly into higher interest rates for SMEs.

## The Design Requirement
To be adopted by distrusting financial institutions, a fraud-prevention rail must satisfy two opposing constraints:
1. **Public Exclusivity:** Any lender must be able to verify that a receivable is not currently active or consumed, and duplicate claims must reliably revert on-chain (`RIGHT_ALREADY_ACTIVE`).
2. **Confidential Deal Flow:** The lender identity, loan amount, and borrower relationship must remain strictly private.

## What Changed in Sole's Architecture
Because institutional lenders will actively avoid any registry that exposes their client book or financing amounts, Sole separates the enforcement state from the economic relationship:
1. The registry tracks only `slot_key -> state -> commitment`. Exclusivity is enforced globally across all venues.
2. The claimant identity and funding note remain shielded inside the STRK20 privacy pool.
3. The lending market (`ExecutionAdapter`) gates financing behind an active, single-use `ExecAuth`, preventing double-disbursement without exposing who holds the right.

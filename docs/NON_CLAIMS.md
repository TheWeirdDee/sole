# Non-Claims

What Sole does not do, stated plainly rather than left implicit. Read alongside
[`PRIVACY_BOUNDARY.md`](./PRIVACY_BOUNDARY.md), which is the single source of
truth for privacy-specific claims — the two privacy-related entries below
summarize it, they do not replace it.

1. **Sole does not prove a real-world receivable exists.** A canonical id is
   an arbitrary reference string. The registry enforces exclusivity over
   whatever claims that id; it has no way to check the underlying financial
   right is real, and does not attempt to.
2. **Sole does not hide that a known right is active.** Anyone holding a
   canonical id can query its state (`UNCLAIMED` / `ACTIVE` / `CONSUMED`).
   Privacy is over the relationship behind that state — the claimant, the
   amount, the counterparty — never over the state itself.
3. **Sole does not hide timing, or that a state transition happened.**
   Transaction timestamps and the fact that some transition occurred are
   public by construction of a public blockchain. What stays hidden is
   *who* and *how much*, not *when* or *whether*.
4. **The canonical-id-to-right mapping is first-registration-wins, not
   attested.** The shipped `FirstRegistrationRoot` assumes the first party
   to register a given id is entitled to. Production use needs an
   attester-signed root behind the same `RightRoot` trait; nothing here
   proves ownership of the underlying right independent of who registered
   first.
5. **`finance()` and `settleAndRepay()` are proven on mainnet; the two
   rejection paths are not.** A live duplicate claim and a live cross-venue
   refusal are both proven in the adversarial test suite
   (`second_claim_on_active_right_reverts`,
   `second_venue_refuses_a_consumed_right`), but neither has landed as a
   real, independently-verified mainnet transaction yet. Ready's paymaster
   refuses to sponsor gas for a call it predicts will revert, which is the
   specific reason a live rejection has been hard to capture through the
   sponsored wallet route — see [`FRICTION_LOG.md`](./FRICTION_LOG.md).
6. **Sole does not implement `EXPIRED`, `CANCELLED`, or
   `PARTIALLY_SETTLED`.** Only `UNCLAIMED -> ACTIVE -> CONSUMED` ships.
   The other transitions are documented as interface and spec only in
   [`STATE_MACHINE.md`](./STATE_MACHINE.md), deliberately not implemented
   before the core three-state machine is proven on mainnet.
7. **The contracts are unaudited, ownerless, and not upgradeable.** No
   admin key, no upgrade path. A finding in the deployed contracts means a
   redeploy to a new address, not a patch. Passing an adversarial test
   suite is evidence, not an audit.
8. **This is experimental, hackathon-stage software.** It has not been
   used to secure a real financial right, has not had meaningful usage at
   scale, and should not be treated as production-ready infrastructure.

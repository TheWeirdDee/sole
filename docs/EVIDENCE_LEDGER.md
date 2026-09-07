# Evidence Ledger

This markdown view mirrors `evidence/claims.json`. The JSON file supplies the
records used by the in-app Docs and Verify pages. Treat a row as current only
after rerunning its command against a live RPC.

```sh
node --experimental-strip-types scripts/verify-mainnet.ts --all
```

The verifier checks the receipt status, block number, exact `actual_fee`,
expected Sole event, and—where applicable—the pool `Deposit`, `Withdrawal`,
and `ExternalContractInvoked(anonymizer, privacy_invoke)` events. It fails if a
receipt no longer matches the ledger.

## Claims

| ID | Status | Claim | Regenerate |
| --- | --- | --- | --- |
| C-1 | Proven — tests; mainnet affirmative transitions | A registered slot has at most one ACTIVE commitment. | `cd contracts && snforge test` |
| C-2 | Pending — tests only | A second claim of an ACTIVE slot reverts `RIGHT_ALREADY_ACTIVE`. | `cd contracts && snforge test` |
| C-3 | Proven — source and receipts | Registry events carry a slot and opaque commitment, not named claimant, raw financing amount, or counterparty fields. | `node --experimental-strip-types scripts/verify-mainnet.ts --all` |
| C-4 | Proven — tests and mainnet | The adapter position is cleared and the registry right is consumed atomically. This is not economic repayment evidence. | `node --experimental-strip-types scripts/verify-mainnet.ts --all` |
| C-5 | Proven — source and receipts | The registry caller is the anonymizer, but a bundled pool deposit can correlate its wallet to the same receipt's slot. | `node --experimental-strip-types scripts/verify-mainnet.ts --all` |
| C-6 | Proven — source and mainnet affirmative case | FallbackMarket records one opaque position for an ACTIVE right and later clears it. It does not transfer assets or call an external market. | `node --experimental-strip-types scripts/verify-mainnet.ts --all` |
| C-7 | Pending — tests only | A distinct shared-registry venue rejects a consumed right. The deployed second adapter is not independently verified. | `cd contracts && snforge test` |
| C-8 | Proven — tests | The adapter recomputes `ExecAuth` rather than trusting a supplied nonce. | `cd contracts && snforge test` |
| C-9 | Proven — tests | The adapter rejects a second position-recording action for an ACTIVE right. | `cd contracts && snforge test` |

## Recorded mainnet receipts

`actual_fee` is the receipt's L2 fee. It is not the same field as the observed
12 STRK public pool deposit or the 6 STRK pool fee withdrawal. Do not add them
together and call the result a universal cost; the wallet's current quote must
be read at submission time.

| Kind | Hash | Block | `actual_fee` | Public pool deposit | Pool fee withdrawal |
| --- | --- | ---: | ---: | ---: | ---: |
| register | [`0x7797…ad7b7`](https://voyager.online/tx/0x7797bdeed0c7a852f0ed025e3f3dafa2fd77417b00937081b443eb00b9ad7b7) | 14,362,577 | 0.059389304541474384 STRK | — | — |
| claim | [`0x3029…14e0`](https://voyager.online/tx/0x3029e23d3eaa0ee82a18b81b828ff49188cb1d8495529248b26e658e53714e0) | 14,433,303 | 2.413112531839398720 STRK | 12 STRK | 6 STRK |
| claim | [`0x1d17…e8c3`](https://voyager.online/tx/0x1d17afaa5c31d35a4465796f9e88248e8b440d5121972b88a601b2ec1abe8c3) | 14,434,308 | 2.394457319569865280 STRK | 12 STRK | 6 STRK |
| claim | [`0x1990…128`](https://voyager.online/tx/0x1990b99a16dc10c8427f8be3942f9568946867d8d24b37e5109e0ad2e19128) | 14,430,741 | 2.475051323596036944 STRK | 12 STRK | 6 STRK |
| claim | [`0x1b01…aa4b`](https://voyager.online/tx/0x1b015f46fc8bccd11ea303e15c6bd5bb9543f3a0fc44c3e7496678c5136aa4b) | 14,445,357 | 2.483245496748478080 STRK | 12 STRK | 6 STRK |
| record position | [`0x62c8…8202`](https://voyager.online/tx/0x62c80fd0e2d782b827e33c1128088c72ba1bdc13eff99b461287bc84e108202) | 14,479,009 | 2.543979712005502704 STRK | 12 STRK | 6 STRK |
| clear position + consume | [`0x31e7…2d85`](https://voyager.online/tx/0x31e7689cb1e267d80909157c094796c864ba6b606a036f07695414ca5292d85) | 14,479,078 | 2.670283691980937408 STRK | 12 STRK | 6 STRK |

All rows above were `SUCCEEDED` and `ACCEPTED_ON_L1` when the ledger was
generated. The verification command, not this sentence, is the authority for a
fresh read.

## Receipt-level privacy fact

Each pool-routed row has a public indexed depositor in its 12 STRK `Deposit`
event. Because it appears atomically with the anonymizer invocation and Sole
event, it can correlate the depositing wallet to the slot. The registry event
does not itself contain a wallet address. See [`PRIVACY_BOUNDARY.md`](./PRIVACY_BOUNDARY.md)
for the complete, deliberately bounded claim.

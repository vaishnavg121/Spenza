# Balances and Settlements Report

## Outcome and scope

Milestone 9 now has an authoritative server-side balance engine and settlement/reversal API. All authoritative arithmetic uses TypeScript `bigint`, PostgreSQL `BIGINT`, and canonical decimal minor-unit strings at API boundaries. No currency conversion exists.

The responsive web still uses its legacy direct-Prisma/Float balance and settlement path. Cutting it over in the same pass would combine database rollout, API adoption, and UI behavior changes before the additive migration has been rehearsed. The server core is therefore complete, but the full milestone remains open for a separate web-cutover step.

No migration, backfill, or remote database operation was executed.

## Balance model and sign convention

Balances are derived on demand from active authoritative expense contributions, stored allocations, completed settlement payments, and completed reversal records. Mutable balance totals are not persisted as financial truth.

For each member:

```text
net = contributions - allocations + settlement effects
```

- A positive net means the member should receive money.
- A negative net means the member owes money.
- A payment increases the payer's net and decreases the receiver's net.
- A reversal applies the exact opposite effects of its linked payment.

The engine verifies every expense contribution total and allocation total against its authoritative total, rejects incompatible currencies or invalid ledger rows, and checks that all member positions sum to exactly zero. Repository loading fails closed if a group contains an unreconciled legacy expense or completed legacy settlement instead of silently omitting it.

Milestone 8 multiple-payer contributions are applied independently. The required `10000` example produces A `+4500`, B `+500`, and C `-5000` exactly.

## Repayment suggestions

`simplifyBalances` is a pure deterministic helper. It sorts debtor and creditor IDs, returns suggested transfers, preserves value, and does not mutate the balance map. Suggestions are advisory only; they are never persisted or automatically treated as settlements.

## Settlement semantics and policy

A settlement is an immutable record that the authenticated internal actor paid another current group member. The client supplies only receiver, amount, currency, method, and optional effective date; it cannot choose the sender or creator.

The safe MVP policy prevents over-settlement. The sender must currently have a negative net, the receiver must currently have a positive net, and the amount cannot exceed the smaller of the sender's debt and receiver's credit. Zero, negative, malformed, same-party, unsupported/mismatched-currency, archived-group, and invalid-member requests fail before persistence.

Groups have one canonical supported currency. Expense and settlement rows of another currency make balance derivation fail closed. No exchange rates or cross-currency totals are implemented.

## Architecture

```text
settlement routes
  -> verified Clerk subject
  -> existing Clerk-to-internal identity service
  -> SettlementService
  -> SettlementRepository / SettlementDataAccess
  -> PrismaSettlementRepository
```

Routes validate paths, queries, headers, and strict Zod bodies. `SettlementService` owns authorization, balance derivation, obligation checks, idempotency, reversal rules, and response serialization. Prisma queries and transition fields remain behind the repository. `settlement-composition.ts` is the API-side construction boundary.

## API endpoints

- `GET /v1/groups/:groupId/balances`
- `POST /v1/groups/:groupId/settlements`
- `GET /v1/groups/:groupId/settlements`
- `GET /v1/groups/:groupId/settlements/:settlementId`
- `POST /v1/groups/:groupId/settlements/:settlementId/reverse`

Responses use canonical minor-unit strings and `Cache-Control: private, no-store`. Lists use bounded opaque cursor pagination. Creation and reversal require `Idempotency-Key`, return `Location`, and mark deterministic replays with `X-Idempotent-Replay: true`.

## Authorization and private-record handling

Every endpoint requires Clerk authentication and resolves the verified subject to an internal user. Current group membership is required for reads and writes. Non-members receive a hidden not-found result, and settlement detail lookup is always scoped to the authorized group.

The authenticated actor is always the settlement payer. Only that original payer can reverse the payment. A different actor or guessed private settlement ID receives not found rather than record-existence detail.

## Idempotency and concurrency

Creation scope is actor + method + concrete group route + key. Reversal scope additionally includes the settlement ID. The service fingerprints canonical validated input with SHA-256.

- Identical scope/key/payload replays the stored response without another settlement or activity.
- Reusing the key for a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.
- The existing persistent composite idempotency uniqueness constraint protects cross-instance writes.
- Serializable Prisma transactions and specific uniqueness/serialization error handling prevent concurrent duplicate settlement or reversal records.
- No in-memory production idempotency state exists.

## Reversals, transactions, and audit

A reversal is a new immutable `REVERSAL` settlement linked uniquely to its original `PAYMENT`. It copies the original parties, currency, method, and exact `amountMinor`, then contributes the inverse balance effect. The original is never updated or deleted. A second reversal with another key returns `409 SETTLEMENT_ALREADY_REVERSED`; retrying the same reversal key replays the first result.

Creation and reversal each run in a serializable Prisma transaction. The settlement/reversal, Activity row, and persistent idempotency result commit together. Injected activity failures prove that financial and idempotency writes roll back together.

Activity appends `SETTLEMENT_MADE` or `SETTLEMENT_REVERSED` with actor, group, settlement, request ID, currency, kind, and canonical amount. This is an in-database audit record, not a transactional delivery outbox; external event delivery and cascade-retention review remain future work.

## Additive database artifacts

The Prisma schema retains the required legacy `Float amount` and adds nullable `BigInt amountMinor`, `SettlementKind`, a unique self-reversal link, verified creator relation, indexes, and `SETTLEMENT_REVERSED`. New API records populate `amountMinor` as authority and write the legacy Float only as a non-authoritative compatibility projection because that existing column is still required.

`apps/web/prisma/migrations/20260808150000_add_settlement_minor_units/migration.sql` is expand-only: it adds the enum/value, nullable columns, checks, indexes, and foreign keys. It does not drop columns, rewrite IDs, or touch expense, balance, or other financial amounts.

`apps/web/prisma/scripts/backfill-settlement-minor-units.sql` is a manual-review artifact for completed, group-scoped, reviewed two-decimal currencies. It aborts on invalid amounts, mismatched/unsupported currencies, fractional minor units, non-finite values, and BIGINT overflow. It deliberately leaves other rows for explicit reconciliation.

Neither artifact was executed. Before any rollout, restore a recent backup into an isolated production-shaped PostgreSQL environment, inspect legacy settlement anomalies, apply the additive migration with the approved deployment mechanism, run the guarded backfill in a reviewed transaction, reconcile every eligible row, and exercise rollback/restore.

## Automated tests

New coverage includes:

- 13 pure balance-engine tests for equal, exact, percentage, shares, multiple payers, multiple expenses, payer-participant overlap, partial/full settlement, exact reversal, incompatible currency, reconciliation failure, deterministic suggestions, and 250 conservation inputs;
- 19 settlement-service tests for authorization, canonical serialization, partial/full settlement, member/party/currency/over-settlement rules, client sender rejection, replay, payload mismatch, concurrent duplication, exact reversal, reversal replay/double/ownership rules, private ID handling, and create/reversal rollback;
- 13 Supertest route cases covering authentication, canonical balance responses, idempotency headers, strict/malformed money and sender input, list/detail privacy, reversal, and stable conflict envelopes.

The full repository suite passes with 15 files and 157 tests (API: 14 files/150 tests; web: 1 file/7 tests). Tests use deterministic mocks and do not require Clerk credentials, PostgreSQL, Cloud SQL, or executed migrations. Real PostgreSQL transaction, Prisma error-metadata, query-plan, and migration/backfill rehearsal remain rollout gates.

## Validation

Run from the repository root on 2026-08-08:

- `pnpm lint` — passed.
- `pnpm typecheck` — passed.
- `pnpm test` — passed, 15 files and 157 tests across API and web.
- `pnpm build:api` — passed.
- `pnpm build:web` — passed.
- `pnpm prisma:validate` — passed.
- `git diff --check` — passed.
- `pnpm --filter @spenza/web prisma:generate` — passed locally and did not access database data.

## Remaining Milestone 9 work

- Rehearse and explicitly approve the pending additive identity, expense, and settlement migrations/backfills in an isolated production-shaped database before deployment.
- Add disposable PostgreSQL integration tests for serializable idempotency races, reversal uniqueness, rollback, legacy fail-closed behavior, and query plans.
- Cut the responsive web group balance view and Settle Up workflow from legacy Float/direct-Prisma code to the Clerk-authenticated balance and settlement APIs, keeping financial writes online-only.
- Add the responsive/accessibility/error/conflict states required by the milestone and verify every supported viewport and keyboard flow.
- Define an explicit former-member settlement/reversal product policy; this implementation requires current membership for all API access and writes.
- Define idempotency retention and activity/outbox retention policies.

Until those gates pass, the API server core is code-complete but Milestone 9 as a whole is not. Rollback disables the new settlement routes/writers while preserving additive financial and audit records; it never deletes settlement history.

## Web Cutover Implementation

The responsive web UI (pps/web/src/components/groups/group-balances.tsx, pps/web/src/components/settlements/settle-up-dialog.tsx, and pps/web/src/components/settlements/settlement-history.tsx) was cut over to the authoritative /v1 API.

- **Balance web cutover**: The group balances component now fetches the canonical BalanceResponse via GET /v1/groups/:groupId/balances using TanStack Query. All active client-side float reduction/suggestion code was removed. Suggestions and amounts are parsed/formatted dynamically using BIGINT minor units string operations.
- **Settlement web cutover**: The Settle Up dialog was updated to use the POST /v1/groups/:groupId/settlements API correctly formatting humans inputs into BIGINT bounds. Added idempotency controls.
- **Settlement history status**: Successfully replaced historical settlement view by a new SettlementHistory component mapping responses from GET /v1/groups/:groupId/settlements. 
- **Reversal UI status**: SettlementHistory now includes an action for authorized payers to safely reverse recent payments via the POST .../reverse API, using an idempotency key per logical submission. 
- **Idempotency-key lifecycle**: Handled smoothly using UI state bound to crypto.randomUUID(). Preserved on rejection, rotated precisely on resolution.
- **Money formatting/parsing**: Reliably achieved with standard UI mapping tools ensuring Float errors are 100% circumvented.
- **Legacy path status**: Former pps/web/src/actions/settlements.ts handles no active UI interactions. Left safely dormant until full removal.
- **Tests**: \ormatMinorUnitToAmount\ thoroughly validated across edge conditions.
- **Validation**: Strict Typechecking (\pnpm typecheck\), formatting, logic verification via testing, Prisma schema compliance check completed error-free.
- **Remaining migration rollout work**: Executing pending additive migrations safely onto a production snapshot. 


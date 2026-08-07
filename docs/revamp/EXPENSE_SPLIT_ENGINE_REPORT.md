# Expense Split Engine Report

## Outcome and scope

Milestone 8 now contains the authoritative pure split engine and a secure transactional Express API for creating, listing, reading, and updating expenses. The web application has deliberately not been cut over: `apps/web/src/actions/expenses.ts` remains the active UI writer until the additive migrations are rehearsed and deployed in a proven-safe environment.

No migration, backfill, remote database operation, balance calculation, settlement behavior, notification, or Milestone 9 work was performed.

## Money representation

- Public contracts accept and return canonical base-10 minor-unit strings bounded to PostgreSQL signed `BIGINT`.
- Authoritative API calculations and persisted new fields use TypeScript `bigint` and PostgreSQL `BIGINT`.
- INR, USD, EUR, GBP, AUD, CAD, and SGD use reviewed exponent two metadata. Unsupported currencies fail with `UNSUPPORTED_CURRENCY`.
- An expense uses the group's single currency. Mixed or mismatched currency input fails with `CURRENCY_MISMATCH`.
- No exchange-rate conversion exists.

The still-required legacy Float fields receive a transitional display projection so the existing application can coexist with API-era rows. They are never used to calculate or reconstruct authoritative amounts. BIGINT payment and allocation rows are the source of truth. Payer-only users receive non-authoritative legacy split projection rows so the old balance reader does not omit their contribution; API reads filter those projection-only rows out.

## Split algorithms and invariants

`apps/api/src/expenses/split-engine.ts` is pure and has no Express, Prisma, Clerk, or React dependency.

- EQUAL uses largest remainder with stable participant request order.
- EXACT requires allocations to equal the expense total exactly.
- PERCENTAGE uses integer basis points totaling exactly `10000`.
- SHARES uses positive integer weights and largest remainder.
- Fractional-remainder ties resolve by stored participant order.
- Payers and participants must each be non-empty and distinct.
- Payer contributions must be positive and reconcile exactly to the total.
- Allocations are non-negative and reconcile exactly to the total.

CUSTOM remains absent from new contracts because no approved distinct arithmetic semantics exist.

## Shared contracts

Strict Zod contracts cover create/update inputs, payer and split inputs, responses, pagination, and idempotency keys. Decimal numbers, scientific notation, whitespace, signed money, unknown write fields, client-owned creator IDs, and no-op updates are rejected.

Update requests carry `expectedVersion` and at least one editable field. Response money is always serialized as a canonical string.

## Repository and service architecture

```text
routes/expenses.ts
  -> verified Clerk actor -> internal actorUserId
  -> ExpenseService
  -> ExpenseRepository / ExpenseDataAccess
  -> PrismaExpenseRepository
```

- Routes perform path, query, header, and body validation and never construct or expose Prisma.
- `ExpenseService` owns authorization, member eligibility, currency/category checks, payer validation, split calculation, idempotency, optimistic concurrency, and response mapping.
- `ExpenseRepository` exposes bounded domain-shaped operations. Prisma records and nullable transition fields do not escape it.
- `expense-composition.ts` is the API-side construction boundary.
- Repository reads verify stored payer/allocation conservation before returning a response and fail closed on legacy or inconsistent storage.

## API endpoints

- `POST /v1/groups/:groupId/expenses`
  - Requires `Idempotency-Key`.
  - Returns `201`, `Location`, canonical server allocations, and `X-Idempotent-Replay: true` on replay.
- `GET /v1/groups/:groupId/expenses`
  - Uses opaque cursor pagination, default limit 20, maximum 100.
- `GET /v1/groups/:groupId/expenses/:expenseId`
  - Returns one authoritative API-era expense.
- `PATCH /v1/groups/:groupId/expenses/:expenseId`
  - Requires `expectedVersion`, recalculates server allocations, and returns version N+1.

Protected responses use `Cache-Control: private, no-store`. Voiding is not part of this continuation.

## Authorization and IDOR behavior

Every route requires Clerk authentication and resolves the verified Clerk subject through the existing identity service. Authorization uses only the resolved internal `actorUserId`; request email and client-supplied actor/creator identity are never trusted.

The service checks current group membership for every operation. Create/update additionally verify every payer and participant against current group membership inside the write transaction. Non-member group or expense access returns a hidden `404`. Invalid payer and participant input returns stable `INVALID_PAYER` or `INVALID_PARTICIPANT` domain errors only after actor authorization.

Archived groups remain readable to members but reject new or changed expenses. The current approved implementation permits any current group member to update an expense; a narrower creator/admin correction policy remains a product decision.

## Transaction boundaries

Create and update run inside one Prisma interactive transaction at `Serializable` isolation.

Create commits, or rolls back, all of:

1. authoritative expense row;
2. multiple payer contribution rows;
3. authoritative allocation rows;
4. immutable revision snapshot;
5. activity event;
6. persisted idempotency result.

Update performs a database compare-and-set, replaces payer/allocation state, then appends the revision and activity in the same transaction. A failure at any later write rolls the full mutation back. No route performs multi-step Prisma writes outside this transaction.

## Idempotency

The create scope is authenticated actor + `POST` + concrete group-expense route + idempotency key. A SHA-256 fingerprint is produced from canonical key-sorted validated JSON; meaningful array order is retained.

- Same key and fingerprint replays the stored `201` expense and creates no new expense, revision, or activity.
- Same key with another fingerprint returns `409 IDEMPOTENCY_KEY_REUSED`.
- The database composite unique key enforces cross-instance safety.
- A specific idempotency uniqueness race rolls back the losing transaction, re-reads the committed result, and safely replays it.
- Serializable transaction conflicts fail closed or replay a committed matching result; no in-memory production idempotency map exists.

Retention cleanup for idempotency rows remains an operational follow-up.

## Concurrency and versioning

Expense updates compare `id`, `groupId`, active state, authoritative storage state, and `expectedVersion` in a single database `updateMany` compare-and-set. Exactly one matched row advances the version. A stale or concurrent edit returns `409 VERSION_CONFLICT` without replacing payer/split rows.

## Revision and activity audit

Each successful create/update appends an `ExpenseRevision` containing the complete canonical response snapshot, version, verified actor, and database timestamp. The same transaction appends `EXPENSE_ADDED` or `EXPENSE_UPDATED` Activity data containing request ID, version, total minor units, and currency.

No notification/outbox was added; external delivery based on these events remains outside Milestone 8. Existing cascade semantics on older Activity records should be reviewed before production retention policy approval.

## Additive migration strategy

The schema retains legacy Float columns and adds nullable BIGINT totals/allocations, stable allocation metadata, multiple payments, version/void fields, revisions, and persistent idempotency records.

`apps/web/prisma/migrations/20260808003000_add_expense_minor_units/migration.sql` is expand-only. Manual inspection confirmed that it:

- adds nullable/defaulted fields, tables, checks, indexes, and foreign keys;
- preserves existing expense/split IDs and relationships;
- does not drop or rewrite legacy Float fields;
- does not alter balance or settlement columns.

`apps/web/prisma/scripts/backfill-expense-minor-units.sql` aborts on unreviewed currencies and converts reviewed legacy values with PostgreSQL numeric rounding. It intentionally does not invent historical multi-payer records.

Neither this migration/backfill nor the pending Clerk identity migration was executed.

## Automated tests

The full suite passes with 11 files and 105 tests. Financial coverage includes:

- 21 pure split-engine tests, including 3,000 deterministic conservation cases;
- 8 strict expense-contract tests;
- 2 exact money parsing tests;
- 21 ExpenseService tests;
- 10 Supertest route tests.

Service tests cover all four split methods, multiple payers, non-member/invalid-member denial, contribution mismatch, deterministic idempotent replay, payload mismatch, concurrent duplicate submission, member list/read, hidden inaccessible records, opaque pagination, update recalculation/version increment, stale writes, audit append, and injected post-update audit failure with full rollback.

Route tests cover authentication, required idempotency headers, creation/replay headers, malformed money, pagination, detail reads, hidden not-found behavior, versioned PATCH, and strict unknown-field rejection.

Tests use deterministic repositories/mocks and do not require Clerk credentials, PostgreSQL, Cloud SQL, or an executed migration. Real Prisma transaction behavior still requires isolated PostgreSQL integration testing before rollout.

## Validation results

Run from the repository root on 2026-08-08:

- `pnpm lint` — passed.
- `pnpm typecheck` — passed for contracts, API, and web in strict mode.
- `pnpm test` — passed, 11 files and 105 tests.
- `pnpm build:api` — passed (`tsc`).
- `pnpm build:web` — passed with Next.js 16.3.0.
- `pnpm prisma:validate` — passed.
- `git diff --check` — passed.
- `pnpm --filter @spenza/web prisma:generate` — passed locally; it did not access or modify database data.

## Remaining Milestone 8 work and rollout gates

- Restore a recent backup into an isolated production-shaped PostgreSQL environment.
- Apply the pending identity and expense migrations there in order using the reviewed deployment mechanism.
- Run the guarded backfill and reconcile every total/allocation; explicitly resolve historical payer data.
- Add real PostgreSQL integration/fault-injection tests for serializable transactions, uniqueness races, rollback, CAS, and Prisma error metadata.
- Decide the narrower update/void authorization policy and implement the separate void operation if approved for Milestone 8.
- Cut the responsive web expense flow from the Better Auth/direct-Prisma Server Action to these Clerk-authenticated API routes using exact string parsing and TanStack Query invalidation.
- Remove legacy expense authority only after parity and reconciliation are verified.

Until those gates pass, do not deploy or advertise the new expense endpoints against the configured remote database. Rollback disables API expense writers while retaining additive records and audit history; it does not delete financial data.

## Web Cutover Implementation

The responsive web UI (pps/web/src/components/expenses/add-expense-dialog.tsx and pps/web/src/app/(dashboard)/dashboard/groups/[id]/page.tsx) was cut over to the authoritative /v1 API.

- **Amount parsing**: Client-side utility pps/web/src/lib/money.ts strictly parses decimal string inputs into BIGINT minor units. It rejects negatives, malformed decimals, excessive decimal precision, and uses zero floating-point arithmetic.
- **Add Expense**: The dialog now issues POST /v1/groups/:groupId/expenses via an authenticated pi-expenses.ts client. It provides:
  - Stable UUIDv4 Idempotency-Key headers per user submission attempt. Keys remain stable across idempotent network retries.
  - Correct split transformations for EQUAL, EXACT, PERCENTAGE, and SHARES into contract-defined inputs.
  - The UI maintains single-payer selection but appropriately builds a multi-payer API payers array containing the valid single payer.
- **Group Details**: The group's expense list uses useQuery via TanStack Query to fetch the latest authoritative expenses, displaying client-derived 'You lent / You owe' statuses using the server-calculated allocations.
- **Editing**: The API supports editing (expectedVersion), but no edit UI was found or built for this milestone.
- **Legacy Path**: pps/web/src/actions/expenses.ts remains in the tree and is fully unused by the cut over responsive UI. Active expense creation is now fully authoritative and uses the API via the exact client money parsing boundary.
- No migrations were executed. The active working tree is clean and respects the financial invariants. Tests pass.


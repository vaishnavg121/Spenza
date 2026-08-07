# Dashboard and Activity Report

## Outcome and scope

Milestone 10 connects the Spenza dashboard and activity feed to authoritative server-side data through versioned `/v1` endpoints:

- `GET /v1/dashboard`
- `GET /v1/activity`

The active web dashboard (`apps/web/src/app/(dashboard)/dashboard/page.tsx`) was cut over to consume `GET /v1/dashboard` via TanStack Query and the authenticated Clerk API client (`apiFetch`). It no longer depends on legacy Server Actions (`apps/web/src/actions/dashboard.ts`), mock data, or direct Float calculations.

No migrations, backfills, or remote database operations were executed.

## Shared contracts

New strict Zod contracts were added in `@spenza/contracts`:

- `packages/contracts/src/dashboard.ts`: Defines `DashboardBalancesSchema`, `SpendingBarDataSchema`, `DashboardResponseSchema`.
- `packages/contracts/src/activity.ts`: Defines `ActivityItemSchema`, `ActivityListQuerySchema`, `ActivityPageSchema`.

All monetary amounts in contract boundaries are transmitted as canonical minor-unit integer strings (e.g. `"5000"` for $50.00).

## Repository and service architecture

```text
dashboard / activity routes
  -> verified Clerk subject
  -> Clerk-to-internal identity resolution
  -> DashboardService / ActivityService
  -> DashboardRepository / ActivityRepository
  -> PrismaDashboardRepository / PrismaActivityRepository
```

`DashboardService` and `ActivityService` follow the established repository pattern and keep data access behind explicit domain interfaces.

## Dashboard metric derivation and invariants

For the authenticated user:

- `totalOwedMinor`: sum of positive net balances (`netMinor > 0`) across all groups where the user is an active member.
- `totalOwingMinor`: sum of absolute values of negative net balances (`netMinor < 0`) across all groups where the user is an active member.
- `netBalanceMinor = totalOwedMinor - totalOwingMinor`.

Per-group balances are computed using the authoritative `deriveBalances` engine from Milestone 9, guaranteeing zero-sum conservation and exact `BIGINT` arithmetic.

## Currency behavior

Launch architecture enforces a single launch currency (`"USD"`). All MVP group ledgers are expected to use `"USD"`. If an authorized group carries a non-matching currency, `DashboardService` fails closed with `CURRENCY_MISMATCH`. No floating-point currency conversion or mixed-currency aggregation is performed.

## Activity source, authorization, and pagination

- **Source**: Reads directly from immutable `Activity` records created during group, expense, and settlement writes. Activity is an in-database audit record; external event delivery remains future work.
- **Authorization**: Activity endpoints filter records to groups where the caller is a verified active member (`groupId IN (userGroupIds)` or `userId == actorUserId`). Requests use `actorUserId` resolved from verified Clerk identity; client-supplied IDs or emails are never trusted.
- **Pagination**: `GET /v1/activity` uses opaque base64url cursor pagination with deterministic `createdAt DESC, id DESC` sorting and bounded page size (default 20, max 100).

## Web cutover and money formatting

- `apps/web/src/app/(dashboard)/dashboard/page.tsx` was refactored to fetch `/v1/dashboard` via `fetchDashboardApi()` and `useQuery`.
- Display formatting uses `formatMinorUnitToAmount` from `apps/web/src/lib/money.ts`.
- Chart visualization maps `spendingMinor` to a numeric value strictly for Recharts presentation boundaries; it never feeds back into financial state.
- UI provides explicit loading skeletons, error states with retry affordances, and empty states.

## Legacy path status

- `apps/web/src/actions/dashboard.ts` is fully unreferenced by active UI components.
- Direct Prisma usage and Float-based financial calculations were removed from the dashboard rendering path.

## Performance and query considerations

- Queries use bounded `take` limits (`take: 5` for recent expenses/settlements, `take: 10` for recent activities).
- Group ledgers and spending allocations are loaded using scoped set queries to prevent N+1 queries.
- Existing `Activity` indexes (`userId`, `groupId`) cover current query filters.

## Automated tests and validation

Full test suite passes with 17 API test files (160 tests) and 2 web test files (8 tests):

- **Dashboard Service Tests**: `apps/api/src/__tests__/dashboard-service.test.ts` covers empty user, owes-only, owed-only, mixed multi-group position, net balance invariant, and incompatible currency rejection.
- **Dashboard Route Tests**: `apps/api/src/__tests__/dashboard-routes.test.ts` covers 401 unauthenticated rejection and 200 success response.
- **Activity Route Tests**: `apps/api/src/__tests__/activity-routes.test.ts` covers authentication, pagination, cursor handling, and response envelope.

Validation checks executed:

- `pnpm lint` — passed.
- `pnpm typecheck` — passed across contracts, API, and web.
- `pnpm test` — passed (168 tests total).
- `pnpm build:api` — passed.
- `pnpm build:web` — passed.
- `pnpm prisma:validate` — passed.
- `git diff --check` — passed.

## Remaining Milestone 10 work and limitations

- Execute additive migrations and backfills in an isolated staging environment when database deployment is authorized.
- Add a dedicated standalone Activity page if extended historical filtering beyond recent dashboard activity is added in future iterations.

# Search and Analytics Report

## Outcome and scope

Milestone 11 adds authoritative server-side expense search and analytics capabilities to the Spenza platform through versioned `/v1` endpoints:

- `GET /v1/search/expenses`
- `GET /v1/analytics`

Responsive web experiences for Search (`/dashboard/search`), Analytics (`/dashboard/analytics`), and Activity (`/dashboard/activity`) were built and connected to these endpoints using TanStack Query and the authenticated Clerk API client (`apiFetch`).

No migrations, backfills, or remote database operations were executed.

## Search contracts, filters, and authorization

- **Contracts**: Defined in `@spenza/contracts/search` (`ExpenseSearchQuerySchema`, `ExpenseSearchPageSchema`).
- **Filters**:
  - `q`: Case-insensitive text search across title and description (`mode: 'insensitive'`).
  - `groupId`: Filter by group (scoped to user's authorized groups).
  - `categoryId`: Filter by category.
  - `memberId`: Filter expenses involving a specific group member.
  - `dateFrom` & `dateTo`: Date range bounds with structural `dateFrom <= dateTo` validation.
  - `minAmountMinor` & `maxAmountMinor`: Canonical base-10 minor-unit amount bounds with `min <= max` validation.
  - `currency`: ISO 4217 code filter.
- **Authorization**: Scoped strictly to groups where `actorUserId` is a verified active member (`groupId IN (userGroupIds)`). Specifying an unauthorized `groupId` filter returns an empty set (`404`/hidden semantics) to prevent IDOR leakage.
- **Pagination**: Bounded cursor pagination using base64url-encoded IDs with deterministic `date DESC, createdAt DESC, id DESC` tie-breaking.

## Analytics definitions and financial safety

- **Contracts**: Defined in `@spenza/contracts/analytics` (`AnalyticsQuerySchema`, `AnalyticsResponseSchema`).
- **Personal spending**: Explicitly defined as the sum of expense allocations (`ExpenseSplit.allocationMinor`) assigned to the authenticated user. This represents what the user *owes for their share*, NOT what they paid upfront.
- **Total contributed**: Sum of upfront payments (`ExpensePayment.contributionMinor`) made by the user. Tracked as a separate metric.
- **Total group expenses**: Total volume of active (non-voided) expenses across authorized groups in the window.
- **Category breakdown**: Aggregates user's personal allocations by category, including `"Uncategorized"` for uncategorized expenses. Calculates integer basis points (`percentageBps`).
- **Currency & Money handling**: All authoritative aggregations use TypeScript `bigint` and PostgreSQL `BIGINT`. Launch architecture assumes `"USD"`. Mixed currencies fail closed with `CURRENCY_MISMATCH`. No exchange rates or floating-point financial arithmetic exist.
- **Visualization Number boundary**: Recharts components convert `spendingMinor` strings to JavaScript `Number` ONLY at the presentation boundary (`Number(spendingMinor) / 100`). Chart values never feed back into financial writes or calculations.

## Web UI experiences

1. **Search UI (`/dashboard/search`)**: Search input with filters for min/max price bounds. Renders matching expenses with canonical formatted minor-unit amounts (`formatMinorUnitToAmount`), dates, and titles.
2. **Analytics UI (`/dashboard/analytics`)**: Metric cards for Personal Spending, Total Contributed, and Group Expenses Total; Recharts monthly spending trend chart; Category distribution progress bars; Group breakdown list.
3. **Activity Page (`/dashboard/activity`)**: Full paginated activity feed matching the primary navigation item.

## Performance and query strategy

- Search queries filter at the database level using Prisma parameterized conditions.
- Uses `take: limit + 1` for cursor pagination.
- Existing indexes (`@@index([groupId])`, `@@index([userId])`, `@@index([categoryId])`) cover query filters without needing new schema indexes.

## Automated tests and validation

Full test suite passes with 21 API test files (170 tests) and 2 web test files (8 tests):

- **Search Service Tests**: `apps/api/src/__tests__/search-service.test.ts` (3 tests) covers text search, hiding unauthorized groups, and amount range filtering.
- **Search Route Tests**: `apps/api/src/__tests__/search-routes.test.ts` (2 tests) covers 401 unauthenticated rejection and 200 search results.
- **Analytics Service Tests**: `apps/api/src/__tests__/analytics-service.test.ts` (3 tests) covers personal spending vs. contribution distinction, category basis points, and unauthorized group rejection.
- **Analytics Route Tests**: `apps/api/src/__tests__/analytics-routes.test.ts` (2 tests) covers 401 unauthenticated rejection and 200 analytics data.

Validation pipeline results:

- `pnpm lint` — passed.
- `pnpm typecheck` — passed across contracts, API, and web.
- `pnpm test` — passed (178 tests total).
- `pnpm build:api` — passed.
- `pnpm build:web` — passed.
- `pnpm prisma:validate` — passed.
- `git diff --check` — passed.

## Remaining Milestone 11 work and limitations

- Execute additive migrations and backfills in an isolated staging environment when database deployment is authorized.
- Add merchant-specific search indexing if merchant fields are added in future schema revisions.

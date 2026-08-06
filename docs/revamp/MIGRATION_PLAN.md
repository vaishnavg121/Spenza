# Spenza Incremental Migration Plan

## Migration strategy

Use a strangler migration, not a big-bang rewrite. First restore a trustworthy baseline for the existing web prototype. Then keep it available under `apps/web-legacy` while the API and mobile application are built beside it. Move one vertical domain slice at a time behind versioned API contracts. Remove the legacy application only after Android/iOS releases, data reconciliation, operational gates, and an agreed rollback window pass.

“Runnable after each phase” means:

- The legacy app remains startable until its replacement is accepted.
- New API/mobile packages have their own start and validation commands from the phase that creates them.
- Root `pnpm` commands identify the supported runnable surfaces and pass for all in-scope packages.
- Database phases use expand-and-contract changes; old readers remain compatible until cutover.
- Every phase has an explicit checkpoint and rollback path.

No phase should combine package-manager cutover, auth cutover, financial schema conversion, and production traffic cutover in one release.

## Phase 1 — Repository cleanup and tooling

### Work

- Tag the audited revision and preserve this audit as the baseline.
- Fix the current web project's lint, strict TypeScript, and production-build failures without changing business semantics.
- Make fonts build offline/reproducibly and set the Next/Turbopack root explicitly.
- Correct the mixed Base UI/Radix trigger API, form input/output typing, button variants, missing toaster host, broken activity link, and `NODE_NODE` typo.
- Split shared Zod schemas out of `'use server'` modules so action files export only valid server functions.
- Declare Zod directly; remove only dependencies proven unused after checks.
- Add `.env.example` with names/descriptions only and runtime environment validation.
- Pin a supported Node LTS, package-manager version, editor settings, formatting, and line-ending policy.
- Add CI secret scanning and dependency review in report-only mode before enforcement.
- Replace the default README with accurate local setup, validation, and safety guidance.

### Verification gate

- Clean checkout can run the documented legacy dev command.
- Legacy lint, strict typecheck, Prisma validate, and production build pass.
- No secret values are committed and environment validation fails safely when required keys are absent.

### Runnable checkpoint and rollback

The root remains the existing npm/Next project during this phase. Keep `package-lock.json` authoritative until the next phase's pnpm lockfile is verified. Roll back individual cleanup commits without touching data.

## Phase 2 — Monorepo restructuring

### Work

- Add `pnpm-workspace.yaml`, root scripts, and a pinned `packageManager` field.
- Move the repaired Next project intact to `apps/web-legacy` while preserving its environment contract and start/build scripts.
- Create empty/scaffolded `apps/api`, `apps/mobile`, `packages/contracts`, `packages/domain`, `packages/database`, `packages/config`, and `packages/test-utils` boundaries.
- Move Prisma ownership to `packages/database` without changing the schema or applying a migration.
- Enforce dependency boundaries so mobile cannot import `database` or Node-only modules.
- Generate and review `pnpm-lock.yaml`; only then retire `package-lock.json` in a dedicated commit.
- Add root filtered scripts: `dev:legacy`, `dev:api`, `dev:mobile`, `lint`, `typecheck`, `test`, and `build`.

### Verification gate

- A clean pnpm install reproduces all packages.
- `pnpm dev:legacy` behaves like the repaired baseline.
- Root lint/typecheck/build cover the legacy package and scaffolds.
- A dependency-graph test proves no mobile-to-database edge.

### Runnable checkpoint and rollback

The legacy app is still the user-visible product. The move must be mechanical and separately reviewable. Rollback restores the root layout and npm lock without any database change.

## Phase 3 — Mobile application foundation

### Work

- Initialize Expo with strict TypeScript and Expo Router inside `apps/mobile`.
- Configure NativeWind tokens, safe areas, keyboard handling, accessibility defaults, reduced motion, and light/dark themes.
- Add TanStack Query, Zustand, React Hook Form/Zod, Clerk Expo, Reanimated, SecureStore, and Notifications using Expo-compatible versions.
- Define environment profiles for local, preview, staging, and production; expose only public mobile configuration.
- Implement public/authenticated route groups, a basic tab shell, error boundary, loading/empty states, API client, and mock-backed dashboard/group screens.
- Establish app icon/splash placeholders only after approved brand assets are available.
- Add EAS development and preview profiles and at least one Android and iOS smoke build.

### Verification gate

- App starts in Expo Go/development build as appropriate and on one Android and one iOS target.
- Router, theme, forms, secure auth cache adapter, query provider, and error boundary are tested.
- Mobile bundle inspection finds no Prisma, database URL, server secret, or Node-only database package.

### Runnable checkpoint and rollback

Mobile remains mock-backed and independently runnable. Legacy web remains unchanged and usable. A failed mobile foundation can be removed without affecting production data or legacy runtime.

## Phase 4 — API stabilization

### Work

- Build `apps/api` with Express, strict TypeScript, Pino, Helmet, CORS, rate limiting, Zod, centralized errors, and request IDs.
- Add liveness/readiness endpoints and graceful shutdown.
- Add validated environment loading and secret redaction before any database integration.
- Define `/v1` response/error/pagination/idempotency conventions in `packages/contracts`.
- Connect the existing schema read-only first through `packages/database`; size the Prisma pool for local use.
- Implement a public health route and one authenticated-stub/read-only vertical slice using repositories and domain services.
- Add Vitest or Jest plus Supertest, isolated PostgreSQL integration setup, and CI.
- Add a development Dockerfile and production multi-stage Docker build.

### Verification gate

- API unit/integration/contract tests pass.
- Container runs as non-root, shuts down cleanly, and exposes only intended routes.
- Rate limits, CORS, body limits, safe errors, and log redaction are verified.
- Mobile can switch from mocks to a local API for the initial read slice.

### Runnable checkpoint and rollback

API is additive and not yet authoritative for production writes. Legacy continues to own current behavior. Disable the mobile API feature flag to return to mocks if necessary.

## Phase 5 — Authentication migration

### Work

- Configure separate Clerk development/staging/production instances and document token templates/claims.
- Add Clerk Expo flows and secure token caching in mobile.
- Verify Clerk JWTs at the API boundary and resolve an internal user by unique Clerk subject.
- Add webhook signature verification, event deduplication, and safe user synchronization.
- Add an additive nullable `clerkUserId` to existing users; do not replace internal primary keys.
- Produce a conflict report for verified-email matching before linking accounts.
- Define existing-user transition: invitation/magic-link/Clerk reset as appropriate; Better Auth passwords and sessions are not copied.
- Run Better Auth for legacy web and Clerk for mobile/API in parallel during the transition.
- Add authorization policy helpers and broken-object-authorization tests for every migrated resource.

### Verification gate

- Valid, expired, wrong-issuer, wrong-audience, and malformed tokens are covered.
- User linking is idempotent and conflicts require manual resolution.
- Existing Better Auth users retain legacy access during the announced transition.
- Mobile sign-in, refresh, sign-out, deep link, and account-deletion entry flows work on both platforms.

### Runnable checkpoint and rollback

The additive Clerk ID can remain unused if rollout is paused. Disable Clerk/mobile traffic without altering internal user IDs. Do not drop Better Auth tables in this phase.

## Phase 6 — Database migration

### Preconditions

- Obtain read-only access or a sanitized dump, confirm whether data is production, and verify backup/PITR.
- Inventory actual tables, constraints, indexes, extensions, collation/time zones, row counts, orphan rows, currency values, and schema drift.
- Reconcile the actual database with the checked-in Prisma model before creating a baseline.

### Work

- Create a reviewed Prisma migration baseline that represents the real database, not assumptions from `schema.prisma`.
- Rehearse restoration and all migrations against a production-shaped clone.
- Introduce financial replacements additively: decimal/minor-unit fields, currency constraints, actor/audit fields, idempotency, versions, and explicit payment/allocation structures.
- Backfill in bounded, observable batches and dual-read/reconcile before any write cutover.
- Add database constraints and indexes after cleaning conflicting data.
- Define archival/retention instead of destructive cascades for financial records.
- Keep old columns/tables during a measured compatibility window.

### Verification gate

- Fresh-database migration, production-clone migration, rollback/restore rehearsal, and Prisma validation pass.
- Reconciliation proves totals, allocations, and per-group net balances exactly match approved legacy expectations or documented corrections.
- Query plans and connection limits meet staging load targets.

### Runnable checkpoint and rollback

Use expand-and-contract: old code continues reading old fields while new fields are populated. Roll back application readers/writers first; restore only under the approved database runbook. No destructive column/table removal occurs here.

## Phase 7 — Groups and memberships

### Work

- Implement group, membership, role, invitation, archive, leave, and remove policies in the domain/API.
- Model invitation token digests, expiry, inviter/invitee, status, and idempotent acceptance.
- Decide support for non-registered participants before schema finalization.
- Implement mobile group list/detail/create/edit/member/invite flows against `/v1`.
- Add pagination, authorization, accessibility, deep links, audit events, and analytics events with privacy review.
- Optionally proxy legacy group reads/writes to the new API only after parity tests.

### Verification gate

- Role/policy matrix has unit and API tests, including cross-group access attempts.
- Invite acceptance is replay-safe and expiry-safe.
- Mobile and API pass end-to-end group journeys on Android/iOS.

### Runnable checkpoint and rollback

Feature flags choose mock/legacy/new API group screens. Schema additions remain backward compatible. Legacy group pages remain available until parity acceptance.

## Phase 8 — Expense and split engine

### Work

- Write a pure, deterministic split engine in `packages/domain` for equal, exact, percentage, and shares; add `CUSTOM` only after its semantics are defined.
- Represent amounts without floating point and document currency exponent/remainder allocation rules.
- Validate payer(s), participants, membership, positive totals, sum invariants, currency, dates, and permissions from server-trusted records.
- Support idempotent create and versioned edit/void behavior in a single database transaction with outbox event creation.
- Define multiple-payer, recurring, category, receipt, notes, and historical-edit scope explicitly; defer unsupported fields rather than silently accepting them.
- Implement allocation preview and authoritative create/detail/list APIs.
- Implement mobile expense forms from shared contracts, with server-returned authoritative allocations.

### Verification gate

- Property-based tests prove allocations are nonnegative and sum exactly to the total across currencies and edge cases.
- Authorization, concurrency, duplicate retry, and tampered participant tests pass.
- Reconciliation fixtures reproduce approved legacy examples and identify intentional corrections.
- Mobile handles slow/offline/retry states without duplicate writes.

### Runnable checkpoint and rollback

Enable new expense writes per environment or cohort. Preserve old financial fields/read path until dual-write reconciliation is stable. Disable the feature flag to return to the legacy writer.

## Phase 9 — Balances and settlements

### Work

- Move balance calculation and debt simplification from React into tested domain/API services.
- Define whether simplification is a view or a persisted obligation and make ordering deterministic.
- Scope every balance by currency; never sum incompatible currencies.
- Implement settlement rules: authorized parties/group, maximum/outstanding amount, currency, confirmation/cancellation policy, idempotency, reversal, and audit.
- Compute writes transactionally and expose group/member summaries and paginated settlement history.
- Implement mobile balance and settlement flows, including confirmation states chosen by product.

### Verification gate

- Invariants prove each group's net balances sum to zero per currency.
- Settlement replay/concurrency/overpayment and unauthorized-party tests pass.
- Reconciliation compares new and legacy balances for every migrated group and explains all deltas.

### Runnable checkpoint and rollback

New balance views can run read-only before settlement writes. Settlement writes roll out behind a separate flag. Old fields remain until reconciliation and rollback windows close.

## Phase 10 — Dashboard and analytics

### Work

- Define dashboard metrics precisely: expense date/time zone, owed versus paid, voids, settlements, and currency filtering.
- Replace in-memory scans with indexed database aggregation, read models, or materialized summaries based on measured scale.
- Add cursor-based recent activity and server-owned safe activity text/metadata contracts.
- Build mobile dashboard cards, trends, filters, empty/loading/error states, and accessible chart alternatives.
- Separate operational/product analytics from financial source-of-truth data; document consent and retention.

### Verification gate

- Metric contract fixtures and reconciliation queries pass across time zones, months, voids, and currencies.
- Staging load tests meet latency/query-count targets.
- Analytics payload review confirms no unintended PII or sensitive notes.

### Runnable checkpoint and rollback

Dashboard is a read-only consumer and can revert to the prior API/read model without changing financial writes.

## Phase 11 — Notifications and uploads

### Work

- Create private GCS buckets/configuration per environment and least-privilege service accounts.
- Implement authorized signed upload intents, direct mobile upload, finalize verification, receipt metadata, viewing, replacement, and deletion/retention.
- Add size/MIME/checksum limits, object randomization, lifecycle rules, and scanning policy.
- Model device installations, preferences, notifications, deliveries, and transactional outbox.
- Register Expo push tokens with the API; implement worker/job retries, receipts, invalid-token cleanup, quiet hours, and safe deep links.
- Add notification permission education and graceful denial behavior on mobile.

### Verification gate

- Cross-user/cross-group upload access, oversized/disallowed files, abandoned uploads, signed URL expiry, and deletion are tested.
- Outbox replay is idempotent; invalid push tokens are retired; notification payloads are safe for lock screens.
- Android/iOS receipt and notification deep-link flows pass in preview builds.

### Runnable checkpoint and rollback

Uploads and push events are independently feature-flagged. Financial records remain valid without a receipt or notification. Disable workers without rolling back core transactions; outbox retains retryable events.

## Phase 12 — Testing and deployment

### Work

- Enforce root lint, strict typecheck, unit, integration, contract, migration, mobile, and container checks in CI.
- Add test coverage thresholds based on risk, with mandatory high coverage for financial domain and authorization policies.
- Finalize Cloud Run container, service account, Cloud SQL connector/network, Secret Manager references, GCS, monitoring, alerts, and runbooks.
- Use a controlled migration job before Cloud Run traffic changes; never run development migrations at startup.
- Add staging smoke/load/security tests and canary/gradual traffic rollout.
- Finalize EAS development/preview/production builds, signing credentials, runtime version/update policy, store privacy declarations, and release checklists.
- Rehearse backup restoration, API rollback, mobile rollback/kill switches, secret rotation, and incident response.

### Verification gate

- Staging production-like release passes all automated and manual acceptance tests.
- SLOs, alerts, dashboards, error budgets, capacity, cost limits, RPO/RTO, and on-call ownership are approved.
- Android internal/closed test and iOS TestFlight releases complete critical journeys.
- Production migration and application rollback rehearsals have recorded evidence.

### Runnable checkpoint and rollback

Cloud Run revisions support traffic rollback; database remains backward compatible through the release window. Mobile feature flags/remote kill switches isolate unfinished domains. Store releases follow staged rollout.

## Phase 13 — Legacy-code removal

### Preconditions

- Clerk account transition is complete or an explicit exception process exists.
- Mobile/API capability and data reconciliation are accepted.
- Legacy traffic is zero for the agreed observation window.
- Audit/retention, support, rollback, and legal sign-off are recorded.

### Work

- Freeze the legacy app read-only, capture final metrics, then archive its last deployable tag/artifact.
- Remove `apps/web-legacy`, Next/React-DOM UI code, Better Auth runtime code, Supabase config/CLI, stock assets, and web-only dependencies.
- Revoke Better Auth secrets/tokens and remove old deployment paths.
- Archive or drop legacy auth/session/account and old financial columns only through separately approved migrations after retention expiry.
- Remove dual-read/dual-write code, compatibility flags, temporary reconciliation jobs, and migration-only permissions.
- Update architecture, onboarding, operations, data dictionary, API, and release documentation.

### Verification gate

- Clean workspace install, lint, typecheck, tests, mobile builds, API container, migrations, and smoke tests pass without legacy code.
- Dependency and secret scans confirm legacy packages/credentials are absent.
- Production telemetry shows no legacy endpoint/client traffic and all reconciliations remain balanced.

### Runnable checkpoint and rollback

Keep an immutable legacy tag/container and compatible database fields for the approved emergency window. Deletion of data-bearing tables/columns is a later, explicit, backup-protected operation—not bundled with source removal.

## Cross-phase decision log required before implementation

- Node/Prisma/Expo version matrix and upgrade policy.
- Money representation, currency rounding, and multi-currency policy.
- User/account linking and non-registered participant behavior.
- Expense edits, reversals, multiple payers, recurring expenses, and settlement confirmation.
- Offline write scope and conflict handling.
- Infrastructure as code and task/worker technology.
- Privacy, analytics, receipts, retention, deletion, and notification payload policy.
- Release SLOs, RPO/RTO, supported OS versions, accessibility target, and store ownership.


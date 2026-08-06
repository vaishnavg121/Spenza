# Spenza Incremental PWA Migration Plan

## Migration strategy

Use an in-place strangler migration, not a native rewrite. The repaired Next.js application is the production-client foundation. Rename it mechanically, make it responsive/installable, and then move unsafe domain slices from direct Prisma/Next.js Server Actions behind a versioned Express API while preserving working behavior.

The previously completed pnpm monorepo restructuring is the baseline. This revised plan starts with promotion of `apps/web-legacy` to `apps/web`.

“Runnable after each phase” means:

- The Next.js application remains startable and production-buildable after every major phase.
- A replacement route or service is not deleted until parity, tests, data reconciliation, and rollback are verified.
- New API packages have their own start/test/build commands from the phase that creates them.
- Database phases use expand-and-contract; old compatible readers remain until cutover evidence exists.
- PWA installation remains progressive enhancement; the normal responsive website remains usable if service-worker or installation behavior is disabled.
- Financial writes require connectivity and are never queued or replayed by a service worker.
- Every phase ends with a tagged/checkpointed state and explicit rollback path.

Do not combine workspace rename, PWA service-worker launch, auth cutover, financial schema conversion, and production traffic cutover in one release.

## Phase 1 — Web application promotion and repository cleanup

### Work

- Record the current clean monorepo and repaired validation results.
- Mechanically rename `apps/web-legacy` to `apps/web` with Git-aware moves.
- Update package name, root scripts, Turbopack paths, environment-file documentation, CI paths, and README references only as required by the rename.
- Preserve the current Next.js/React/Prisma dependency versions and behavior.
- Reconfirm secret hygiene without printing values.
- Keep `apps/mobile/.gitkeep` temporarily. After PWA-first direction and references are confirmed, remove the empty placeholder in a separate reviewed cleanup commit.
- Keep `apps/api/.gitkeep` until Phase 4.

### Verification gate

- Clean pnpm install succeeds.
- Pre/post route manifest, lint, strict type-check, Prisma validation, and production build are equivalent.
- No schema, migration, auth behavior, business logic, or UI behavior changed.

### Runnable checkpoint and rollback

`pnpm dev:web` and `pnpm build:web` target `apps/web`. Revert the mechanical rename/config commit to return to `apps/web-legacy`; no data rollback is required.

## Phase 2 — Responsive design foundation

### Work

- Characterize all existing routes, layouts, dialogs, forms, tables, charts, empty/loading/error states, and keyboard behavior.
- Define semantic spacing, typography, color, elevation, focus, motion, and responsive tokens.
- Establish phone-first page/navigation shells, tablet composition, bounded desktop layouts, and standalone-window resizing behavior.
- Retain and harden accessible UI components where suitable; replace only components with demonstrated accessibility or responsive blockers.
- Add light, dark, and OLED themes without changing product workflows.
- Add visual fixtures and accessibility test utilities before migrating individual screens.

### Verification gate

- Current routes remain behaviorally available at phone/tablet/desktop widths.
- Keyboard order, focus visibility/restoration, labels, zoom/reflow, contrast, reduced motion, and minimum touch targets pass agreed checks.
- Lint, type-check, component tests, visual tests, and production build pass.

### Runnable checkpoint and rollback

Land shared primitives and screen migrations separately. Retain old variants until each consuming route is verified; revert a route to its prior layout without touching data or API behavior.

## Phase 3 — PWA foundation and installation

### Work

- Add App Router manifest metadata with stable `id`, name, short name, start URL, scope, standalone mode, and approved colors.
- Add reviewed 192/512 icons, maskable icon, Apple touch icons, and favicon.
- Implement a minimal root-scoped service worker with versioned cache names and an explicit allowlist.
- Precache only reviewed static shell assets and a data-free offline fallback.
- Add safe registration, update-available UX, activation/reload guards, diagnostics, and recovery guidance.
- Add install affordance only when supported, plus Android/desktop and iOS Add to Home Screen guidance.
- Add connectivity state that disables protected/financial submission offline without queueing.

### Verification gate

- Manifest, icons, HTTPS assumptions, start URL/scope, and standalone behavior validate.
- Service-worker tests prove authenticated API/auth/receipt/private HTML/mutations/push subscriptions are not cached.
- Offline navigation shows only the fallback; financial controls stay unsaved/disabled; no Background Sync exists.
- Install/update/uninstall smoke tests pass on approved representative platforms where available.

### Runnable checkpoint and rollback

The normal Next.js app works when registration is disabled. Roll back through a forward web release that unregisters the worker/deletes only known caches; do not rely on manual user cache clearing.

## Phase 4 — API foundation

### Work

- Initialize `apps/api` with Express, strict TypeScript, Pino, Helmet, explicit CORS, distributed-capable rate limiting, Zod, request IDs, safe errors, and graceful shutdown.
- Implement liveness/readiness and validated environment loading before database integration.
- Define `/v1` envelopes, pagination, cache controls, idempotency, and request IDs in `packages/contracts`.
- Introduce the web typed API client with token injection only at the supported Clerk boundary.
- Connect the current schema read-only first through an API-only database package.
- Add Vitest/Supertest, isolated PostgreSQL integration setup, CI, and non-root container.

### Verification gate

- API unit/integration/contract tests and container build pass.
- CORS, body limits, rate limiting, private/no-store headers, safe errors, health, shutdown, and log redaction are verified.
- Dependency tests prove `apps/web` cannot import Prisma/database code through new packages.

### Runnable checkpoint and rollback

The API is additive and not authoritative for product writes. Web features remain on working current paths until migrated. Disable the API client feature flag/remove the unused API revision without data changes.

## Phase 5 — Authentication and profiles

### Work

- Configure separate Clerk development/staging/production instances and approved web origins/callbacks.
- Implement supported Clerk Next.js session flows without token persistence in browser storage.
- Verify Clerk JWTs in Express and map verified subjects to internal users.
- Implement `/v1/me`, avatar allowlist, profile validation, and account-scoped cache cleanup.
- Add webhook signature verification/event deduplication.
- Define and test CORS/CSRF/cookie/CSP behavior for the selected hosting/API topology.
- Retain Better Auth in parallel until identity migration is accepted.

### Verification gate

- Valid/expired/wrong issuer/audience/authorized-party/malformed token tests pass.
- Sign-in, callback, restoration, sign-out, account switch, and protected-route flows pass in browser and standalone modes.
- Browser/Cache Storage inspection finds no tokens or private auth responses.
- Better Auth users retain the documented fallback during transition.

### Runnable checkpoint and rollback

Disable Clerk routes/API traffic and return to Better Auth-compatible entry without changing internal IDs. Additive mappings remain unused; do not drop auth tables.

## Phase 6 — Database identity migration

### Preconditions

- Obtain approved read-only inventory or sanitized dump.
- Confirm data classification and backup/PITR status.
- Reconcile the checked-in schema with the actual database before authoring a baseline.

### Work

- Add nullable unique Clerk subject mapping and any required profile/account-link state.
- Produce verified-email matching and ambiguity reports without printing full PII.
- Backfill in bounded idempotent batches; quarantine ambiguous/missing cases.
- Preserve stable internal user IDs and all ownership foreign keys.
- Keep Better Auth passwords/sessions/tokens provider-specific and read-only for transition/retention.
- Add support and rollback runbooks.

### Verification gate

- Empty/sanitized-production migration and rollback/restore rehearsals pass.
- User/ownership counts reconcile before/after.
- Duplicate/changed/missing-email and webhook replay cases have explicit outcomes.
- Authorization regression covers migrated and unmigrated users.

### Runnable checkpoint and rollback

Stop linking and revert identity resolution to compatibility mode. Ignore or null additive links using the reviewed reversal path; restore only if reconciliation requires it.

## Phase 7 — Groups and memberships

### Work

- Define group/member/role/invitation/archive/leave/remove policies and unresolved owner/non-registered-participant decisions.
- Add invitation token digests, expiry/status, lifecycle/audit fields, and indexes additively.
- Implement authorized, transactional `/v1` services/routes with cursor pagination and idempotent invitation acceptance.
- Migrate responsive group routes/forms from Server Actions/direct Prisma to the API.
- Preserve prior group pages/paths until API parity and data reconciliation pass.

### Verification gate

- Full role/IDOR matrix, replay/expiry/concurrency, owner transition, pagination, and audit tests pass.
- Browser and installed-mode critical group journeys pass across responsive targets.
- Existing/new group records reconcile.

### Runnable checkpoint and rollback

Feature flags choose the existing or new API-backed group path. Schema additions remain backward compatible and no membership is deleted during rollback.

## Phase 8 — Expense split engine

### Work

- Build a pure deterministic equal/exact/percentage/shares engine from `docs/FINANCIAL_INVARIANTS.md`.
- Use integer minor units/`bigint`, stable allocation order, and explicit currency.
- Add expense payments, allocations, revisions/voids, versions, actor/audit, constraints, indexes, and idempotency additively.
- Profile and reconcile actual legacy expense/split data before write cutover.
- Implement authorized preview/create/read/edit/void routes transactionally with immutable activity/outbox.
- Migrate responsive web expense forms/details with explicit online-only submission and provisional optimistic state.

### Verification gate

- Fixed and property tests prove conservation, integer/nonnegative allocations, determinism, edit/void exactness, and boundary behavior.
- Membership tampering, IDOR, retry, concurrency, fault injection, and currency tests pass.
- Production-shaped reconciliation explains every legacy/new delta.
- Offline/service-worker tests prove no financial mutation is queued.

### Runnable checkpoint and rollback

Roll out by environment/cohort. Disable new writes first and return to the last compatible writer while retaining additive records and audit history. Do not delete old fields.

## Phase 9 — Balances and settlements

### Work

- Move balance and debt-suggestion logic from React into pure/API services.
- Derive currency-scoped member positions from active expense contributions/allocations and settlements.
- Add settlement/reversal structures, authorization, idempotency, activity, and optional rebuildable projections.
- Migrate responsive balances and settlement forms/history with unambiguous direction and online-only writes.
- Reconcile all migrated groups against approved expected results.

### Verification gate

- Zero-sum property holds per group/currency across randomized sequences.
- Settlement/reversal/retry/concurrency/overpayment/mixed-currency/IDOR tests pass.
- Rebuildable projections match source records.
- UI accessibility and owed/owing copy pass product review.

### Runnable checkpoint and rollback

Release balances read-only before enabling settlement writes. Disable settlement writes independently, revert projections/read paths, and never mutate historical records to imitate rollback.

## Phase 10 — Dashboard and activity

### Work

- Define dashboard/date/time-zone/currency/void/settlement metrics precisely.
- Add authorized cursor-based activity and server-owned typed event representations.
- Replace full in-memory scans with measured indexed queries or rebuildable read models.
- Migrate responsive dashboard cards, activity timeline, accessible chart alternatives, and stale/offline states to API data.
- Keep operational/product analytics separate from financial truth.

### Verification gate

- Dashboard totals reconcile with balance endpoints and metric fixtures.
- Authorization, ordering/ties, inaccessible references, query budgets, and renderer tests pass.
- Responsive, keyboard, screen-reader, theme, and performance checks pass.

### Runnable checkpoint and rollback

Dashboard/activity are read-only consumers. Route users to the prior/basic views and rebuild/discard projections without changing financial sources.

## Phase 11 — Search and analytics

### Work

- Define bounded filters/sorts/date/currency semantics and authorization-before-search rules.
- Add only indexes/materialized views justified by representative query plans.
- Implement versioned search/analytics routes with cursor pagination and route-specific rate limits.
- Add responsive search/results/filter UI and accessible descriptive charts/summaries.
- Avoid persisting sensitive search state beyond the approved browser/session boundary.

### Verification gate

- IDOR/leakage, filter combinations, cursor determinism, malformed/expensive queries, time zones, currencies, reconciliation, and rate limits pass.
- Representative query plans meet budgets.
- UI is accessible and never silently combines currencies.

### Runnable checkpoint and rollback

Disable routes/entry points; retain source records; remove only disposable projections in a later reviewed cleanup.

## Phase 12 — Notifications and receipt uploads

### Work

- Configure private GCS buckets, least-privilege service accounts, explicit web-origin CORS, and lifecycle policy.
- Implement authorized signed upload request/direct browser upload/finalize/read/replace/remove.
- Add MIME/signature/size/dimension/checksum validation and approved scanning policy.
- Model browser Push API subscriptions, preferences, notifications, delivery attempts, and transactional outbox.
- Implement permission education, subscription rotation/unsubscribe/account switch, service-worker push display, privacy-safe payloads, and authorized deep links.
- Provide in-app fallback when Push API is unsupported or denied.

### Verification gate

- Cross-user/group uploads, malicious/oversized types, expiry, orphan cleanup, duplicate finalize, and no-cache receipt behavior pass.
- Push allow/deny/unsupported/rotation/replay/dedup/provider failure/deep-link authorization pass on representative supported platforms.
- No push endpoints/keys, signed URLs, or sensitive payloads enter logs/caches.

### Runnable checkpoint and rollback

Uploads and push are independently feature-flagged. Disable workers/new subscriptions without affecting financial transactions; retain outbox/metadata for recovery and clean only verified orphans.

## Phase 13 — Testing, deployment and PWA release

### Work

- Enforce root lint, strict type-check, unit, integration, contract, migration, web E2E, PWA, accessibility, security, and container gates.
- Select/configure Next.js hosting, domains, HTTPS, CDN/cache headers, environment promotion, observability, and rollback.
- Finalize Cloud Run API, Cloud SQL connector/network/pools, Secret Manager, GCS, controlled migration jobs, dashboards, alerts, and runbooks.
- Validate manifest/icons/install/update/offline/service-worker rollback and supported browser matrix.
- Rehearse web/API/database rollback, backup restore, secret rotation, bad service-worker recovery, and incident response.
- Use staged/canary release and publish accurate PWA capability/limitation guidance.

### Verification gate

- Production-like staging passes all automated/manual critical journeys, security, accessibility, performance, load, restore, and reconciliation tests.
- No secret/database/server package appears in browser/service-worker bundles.
- SLOs, capacity/cost, RPO/RTO, support matrix, on-call, hosting, DNS, Clerk, push, and release ownership are approved.
- Android, desktop Chrome/Edge, iPhone, and iPad installation/update paths are tested where available; unsupported capability fallback is verified.

### Runnable checkpoint and rollback

Use compatible Next.js and Cloud Run revision rollback, a forward service-worker cache version, feature flags/worker stops, and the tested database forward/restore decision tree.

## Phase 14 — Later native and advanced enhancements

### Work

- Use production PWA telemetry/research to decide whether native Expo investment is justified.
- Treat native, OCR, AI, budgets, conversion, recurring expenses, offline writes, comments, exports, QR invites, and advanced animation as separate product briefs.
- Keep the versioned API compatible with the supported PWA while adding any new client.
- Require dedicated privacy, security, cost, data, migration, support, and rollback design per slice.

### Verification gate

- Each approved slice has measurable success criteria, updated contracts/invariants, full regression coverage, and a feature-level rollback.
- Native work, if approved, adds explicit supported OS, app-store, signing, privacy, update, and PWA coexistence gates.

### Runnable checkpoint and rollback

The production PWA and core API remain supported and independently deployable. Disable the individual enhancement/client rollout without changing authoritative MVP records.

## Cross-phase decisions required before implementation

- Supported browser/OS matrix, accessibility target, and installed-PWA support window.
- Next.js host, domains, CDN, and same-origin versus cross-origin API topology.
- Manifest colors/icons/screenshots and brand owner.
- Node/Prisma/Next.js version matrix and upgrade policy.
- Clerk web session/token topology and Better Auth account-linking transition.
- Money/currency policy and product rules listed in `docs/PRODUCT_SCOPE.md`.
- Unsaved-draft/browser-storage policy; offline financial writes remain prohibited regardless.
- Web Push/VAPID/provider ownership, payload/privacy policy, and fallback communication.
- Infrastructure as code, worker technology, privacy/retention, SLOs, RPO/RTO, and release ownership.

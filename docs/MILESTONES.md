# Spenza Revamp Milestones

## How to use this plan

This is the execution sequence for the responsive web/PWA and backend revamp. The repository audit and rationale remain under `docs/revamp/`; `docs/revamp/PWA_STRATEGY_CHANGE.md` records why the former Expo-first plan was superseded.

- Complete milestones in order unless a reviewed dependency change says otherwise.
- Work on only the explicitly requested milestone. A milestone may be split into smaller commits, but its definition of done remains the gate.
- Keep the repaired Next.js application runnable throughout migration. Promote and harden it; do not replace it wholesale.
- Use additive schema evolution, feature flags, compatibility adapters, and reversible traffic changes.
- Re-run affected lint, strict type-check, tests, production builds, Prisma validation, PWA checks, and security checks at every milestone.
- Do not use this roadmap as authorization to run a production migration, delete functioning code, rotate credentials, or change live infrastructure.
- Financial writes are online-only for MVP and must never be queued by a service worker or browser background sync.

The completed pnpm monorepo restructuring is the starting baseline. The milestones below define the revised PWA-first work beginning with promotion of the existing web workspace.

## Milestone 1 — Web application promotion and repository cleanup

**Goal:** Promote the repaired Next.js application to the production web foundation without changing product behavior.

**Scope:** Mechanically rename `apps/web-legacy` to `apps/web`; update workspace names, root scripts, paths, documentation, and CI references; preserve Git history and the validated build; confirm the PWA-first direction before removing obsolete placeholders in a separate cleanup commit.

**Affected areas:** `apps/web-legacy` → `apps/web`, root workspace/tooling configuration, shared lint/TypeScript config, README, CI paths, and documentation. `apps/mobile` remains `.gitkeep`-only until its separately reviewed cleanup.

**Database changes:** None. Prisma schema and migration state remain byte-for-byte equivalent.

**API work:** None. `apps/api` remains an uninitialized placeholder.

**Web/PWA work:** No PWA dependency or behavior yet. Rename and product terminology only; retain every working route and UI flow.

**Tests:** Compare pre/post lint, strict type-check, Prisma validation, production build, route manifest, and tracked-secret scan; verify clean pnpm install and root commands.

**Exclusions:** Feature changes, responsive redesign, manifest/service worker, Express initialization, Clerk migration, schema changes, dependency upgrades, and deletion of functioning code.

**Definition of done:** `apps/web` reproduces the repaired baseline, all root gates pass, no source behavior or schema changed, and Git status contains only reviewed promotion/cleanup changes.

**Rollback considerations:** Revert the mechanical rename/config commit. No data or live-service rollback is required. Remove `apps/mobile` only in a later dedicated cleanup after confirming no workspace/document reference depends on it.

## Milestone 2 — Responsive design foundation

**Goal:** Establish an accessible mobile-first layout and component foundation across phone, tablet, and desktop without adding product features.

**Scope:** Inventory existing routes/components; define semantic design tokens, responsive breakpoints, page shells, navigation patterns, form/layout primitives, loading/empty/error states, and light/dark/OLED themes; retain suitable accessible components.

**Affected areas:** `apps/web` layouts, global styles, UI primitives, component documentation/tests, responsive fixtures, and visual-regression setup.

**Database changes:** None.

**API work:** None beyond typed mock boundaries where required to isolate view tests.

**Web/PWA work:** Responsive shell, keyboard/focus behavior, touch targets, semantic navigation, reduced motion, reflow/zoom support, and placeholder states at the ranges in `docs/PWA_REQUIREMENTS.md`.

**Tests:** Component/unit tests, automated accessibility checks, keyboard flows, representative viewport/zoom visual tests, strict type-check, lint, and production build.

**Exclusions:** Manifest/service worker, install prompts, real push, Clerk, domain/API migration, new expense/group features, and broad visual redesign unrelated to responsiveness/accessibility.

**Definition of done:** Existing routes remain functional and render without horizontal page overflow or lost actions across the approved responsive matrix; core primitives meet the agreed accessibility baseline; all gates pass.

**Rollback considerations:** Responsive changes land in small component/shell commits and can be reverted independently; retain old component variants until consuming screens are verified.

## Milestone 3 — PWA foundation and installation

**Goal:** Make the responsive web application safely installable without enabling offline financial behavior.

**Scope:** Add the Web App Manifest, approved icons/maskable icons, HTTPS assumptions, minimal service worker, explicit cache allowlist, static offline fallback, update/version UX, install guidance, and capability detection.

**Affected areas:** Next.js metadata/manifest routes, public PWA assets, service-worker source/registration, offline page, cache-policy tests, release version metadata, and PWA documentation.

**Database changes:** None.

**API work:** Add only cache/version headers or a public compatibility endpoint if justified; no domain endpoints.

**Web/PWA work:** Standalone display, start URL/scope, safe-area/installed-mode handling, Android/desktop install affordance where supported, iOS Add to Home Screen guidance, and online/offline/update states.

**Tests:** Manifest/schema/icon checks; service-worker install/activate/fetch/update/rollback tests; proof that private/auth/API/receipt/mutation data is never cached; offline fallback; installation smoke tests on representative Android, Chrome, Edge, iPhone, and iPad targets where available.

**Exclusions:** Offline write queues, Background Sync, push delivery, Clerk migration, domain API work, app-store packaging, and native Expo initialization.

**Definition of done:** Approved browsers recognize the PWA; supported targets can install it; normal browser use remains complete; updates are safe; offline navigation is truthful/read-only; all financial writes remain online-only.

**Rollback considerations:** Unregister/disable the service worker through a forward release, delete only known versioned caches, and keep the normal online Next.js application deployable without PWA enhancement.

## Milestone 4 — API foundation

**Goal:** Establish a production-oriented Express service with secure defaults, contracts, observability, and test infrastructure.

**Scope:** Initialize `apps/api`; configure strict TypeScript, Express, Zod environment/request validation, Pino redaction, Helmet, explicit CORS, distributed-capable rate limiting, request IDs, typed errors, health endpoints, graceful shutdown, and Vitest/Supertest.

**Affected areas:** `apps/api`, `packages/contracts`, shared config, API tests, container files, root/CI scripts, and local environment examples.

**Database changes:** None to domain schema. A readiness check may verify connectivity with a least-privileged account without mutation.

**API work:** `/health/live`, `/health/ready`, middleware order, response/error envelopes, request ID propagation, body limits, cache headers, and a fail-closed authenticated placeholder.

**Web/PWA work:** Add one typed API-client boundary and optionally consume health/version metadata; existing domain behavior remains on its working path.

**Tests:** Middleware/error/CORS/rate-limit/cache/redaction/health/shutdown tests; container starts non-root on Cloud Run host/port conventions; web client error decoding tests.

**Exclusions:** Domain routes, Clerk identity cutover, schema changes, uploads, push delivery, and production traffic changes.

**Definition of done:** API lint/type/tests/build pass; container behavior and health semantics are correct; missing secrets fail safely; no domain endpoint is public accidentally; web baseline still builds.

**Rollback considerations:** Remove or scale the unused API revision to zero; route the web app through its prior working paths; no data rollback.

## Milestone 5 — Authentication and profiles

**Goal:** Implement Clerk authentication from the Next.js application through the Express API while retaining a safe transition path for Better Auth users.

**Scope:** Configure Clerk web sessions/routes; verify Clerk JWTs in Express; map verified subjects to internal users; implement `GET/PATCH /v1/me`; support approved built-in avatars; define account-linking states.

**Affected areas:** Web auth routes/middleware/providers, API auth middleware/policies/profile service, contracts, environment schemas, avatar manifest/assets, and auth/profile tests.

**Database changes:** Additive identity-mapping/profile fields or tables with uniqueness/indexes. Do not remove Better Auth tables or internal user IDs.

**API work:** Token verification, internal-user resolution, profile read/update, safe bootstrap, stable `401`/`403`, and verified/idempotent Clerk webhook handling.

**Web/PWA work:** Sign-in/up/out, session restoration, protected navigation, callback handling, profile editing, avatar selection, account-switch cleanup, and no token persistence in browser storage/service-worker caches.

**Tests:** Claim failure matrix, key rotation, wrong issuer/audience/authorized party, CSRF/CORS/session behavior, profile validation, avatar allowlist, protected navigation, IDOR-negative cases, and redaction.

**Exclusions:** Automatic ambiguous account merging, Better Auth deletion, groups, financial features, unsupported identity providers, and native auth.

**Definition of done:** Staging users authenticate in supported browsers/installed modes; API identity derives only from verified claims; profile operations are authorized; browser storage/cache inspection finds no tokens; additive rollback path is approved.

**Rollback considerations:** Disable Clerk routes/traffic, retain additive mappings unused, and keep Better Auth access until identity migration and rollback windows are complete.

## Milestone 6 — Database identity migration

**Goal:** Safely link eligible Better Auth identities to Clerk-backed internal users while preserving ownership and financial history.

**Scope:** Inventory real database state; define matching/ambiguity policy; backfill non-destructive links; support controlled compatibility reads; reconcile users, sessions, accounts, and ownership; prepare operator runbooks.

**Affected areas:** Prisma schema/migrations, backfill/reconciliation scripts, identity adapter, audit queries, support runbook, and risk register.

**Database changes:** Additive identity constraints/indexes and bounded backfill. Legacy auth tables/identifiers remain during the retention window; never copy passwords or provider tokens to Clerk.

**API work:** Resolve migrated/new users consistently, expose safe linking error states, preserve ownership, and process identity webhooks idempotently.

**Web/PWA work:** Handle reauthentication/linking/manual-review states without exposing matching data; clear account-scoped query/browser state on transition.

**Tests:** Sanitized production-shaped migration; duplicate/missing/changed-email cases; ownership counts; webhook replay; rollback rehearsal; Prisma validation; cross-identity authorization regression.

**Exclusions:** Guessing ambiguous matches, dropping Better Auth data, rewriting financial history, live migration without backup/approval, and unrelated schema cleanup.

**Definition of done:** Every candidate has a documented disposition; counts/ownership reconcile; ambiguous records are quarantined; backup/rollback are tested; legacy auth remains available until cutover approval.

**Rollback considerations:** Stop new linking, revert application traffic/config to compatibility mode, and ignore/null additive links through the reviewed reversal procedure; restore only when reconciliation requires it.

## Milestone 7 — Groups and memberships

**Goal:** Deliver authorized group, membership, role, and invitation workflows through the API and responsive web client.

**Scope:** Group CRUD/archive, group currency, membership lifecycle/roles, invitations, owner transfer/last-owner protections, and historical-member policy.

**Affected areas:** Group/membership/invitation models/migrations, API services/routes/contracts/policies, web routes/forms/components, activity events, and tests.

**Database changes:** Additive/adapted structures with unique membership constraints, invitation token digests, expiry/status, audit fields, and indexes. Preserve legacy records for verified backfill.

**API work:** Versioned group/member/invitation endpoints; policy enforcement; cursor lists; transactional transitions; idempotent invitation acceptance; immutable activity.

**Web/PWA work:** Responsive group list/detail/create/edit/member/invite flows; link handling in browser and standalone modes; complete loading/empty/error/offline-write-disabled states.

**Tests:** Role/IDOR matrix; duplicate membership; expired/revoked/replayed invitation; owner departure; concurrent acceptance; guessed IDs/tokens; pagination; activity; responsive/browser journeys.

**Exclusions:** Expenses, balances, contacts scraping, QR invitations, receipt uploads, and cross-currency groups.

**Definition of done:** A user creates/joins groups and sees only authorized groups; transitions are transactional/audited; confirmed lifecycle policy is enforced; working prior paths are removed only after parity.

**Rollback considerations:** Feature-flag new group API/UI paths, preserve additive data, and route users to the last compatible working implementation without deleting memberships.

## Milestone 8 — Expense split engine

**Goal:** Implement the authoritative, tested expense engine for all MVP split methods and multiple payers.

**Scope:** Expense create/read/edit/void; equal/exact/percentage/shares allocation; multiple payers; integer-minor-unit validation; deterministic rounding; optimistic concurrency; idempotency; immutable activity.

**Affected areas:** Pure domain engine, financial contracts, Prisma expense/revision/payer/allocation/idempotency structures, API services/routes/policies, responsive forms/details, and fixtures.

**Database changes:** Additive financial structures using `BIGINT` minor units, currency, stable allocation order, versions/status/revisions, actor/audit links, idempotency, constraints, and indexes. Do not destructively alter old columns.

**API work:** Expense endpoints and preview; group/member authorization; transactional writes plus activity/outbox; authoritative stored allocations; version conflict and idempotent replay.

**Web/PWA work:** Responsive payer/split forms, reconciliation feedback, explicit online requirement, pending/rollback state, details/revisions, and void confirmation. No service-worker mutation queue.

**Tests:** Every example/property in `docs/FINANCIAL_INVARIANTS.md`; large values; malformed minor units; membership tampering; multi-payer totals; retry/concurrency/fault injection; IDOR; form/accessibility/offline behavior.

**Exclusions:** Settlements, currency conversion, recurring/offline writes, OCR, AI categorization, and unapproved legacy-data cutover.

**Definition of done:** Calculations conserve value exactly/deterministically; writes are authorized, transactional, idempotent/versioned/audited; no floating-point authoritative path exists; UI reconciles to server results.

**Rollback considerations:** Disable new writes first, retain read/audit access, revert API/web to the last compatible writer, and keep additive financial records/schema intact.

## Milestone 9 — Balances and settlements

**Goal:** Provide reproducible group balances and auditable settlement/reversal workflows.

**Scope:** Derive net positions from active expenses and settlements; expose balances; record settlements and linked reversals; optionally show deterministic non-authoritative debt suggestions.

**Affected areas:** Balance projection/service, settlement/reversal models/migrations, API routes/contracts/policies, responsive balance/settlement UI, reconciliation tools, and tests.

**Database changes:** Additive settlement/reversal structures with integer minor units, currency, actor/effective date, idempotency, immutable links, and indexes. Caches/read models remain rebuildable.

**API work:** Balance read; settlement create/read/reversal; authorization, transaction, idempotency, activity, concurrency, and per-currency output.

**Web/PWA work:** Clear owed/owing direction, accessible member breakdown, settlement/history/reversal states, online-only submission, visible conflict/retry behavior, and no claim that Spenza moves money.

**Tests:** Zero-sum property; multiple payers; edit/void; settlement/single reversal; retries/concurrency; mixed-currency rejection; cache rebuild; IDOR/former-member policy; responsive/accessibility flows.

**Exclusions:** Payment processing, bank links, automatic transfers, conversion, settlement deletion, offline settlement queue, and authoritative debt optimization.

**Definition of done:** Balances reproduce from source records and sum to zero per group/currency; settlement effects apply exactly once; UI direction is unambiguous; reconciliation passes.

**Rollback considerations:** Disable settlement writes, keep records readable, rebuild/discard projections, and revert compatible API/web revisions without mutating history.

## Milestone 10 — Dashboard and activity

**Goal:** Give members an authorized responsive overview and immutable timeline based on committed events.

**Scope:** Dashboard summaries, net positions, unsettled items, recent activity, and paginated typed activity events/read models.

**Affected areas:** Dashboard/activity queries/projections, API endpoints/contracts, web routes/components, activity renderer registry, indexes, and tests.

**Database changes:** Additive activity fields/indexes or rebuildable read models. Events remain append-only; backfills are deterministic and provenance-marked.

**API work:** Authorized dashboard summary and cursor activity endpoints; per-currency grouping; stable event representations; bounded query plans and private cache headers.

**Web/PWA work:** Responsive cards/timeline, refresh/loading/error/empty/stale states, accessible chart alternatives, and safe rendering for inaccessible/deleted references.

**Tests:** Authorization leakage; cursor stability/order ties; renderer coverage; currency reconciliation; query budgets; inaccessible references; responsive/keyboard/screen-reader states.

**Exclusions:** Arbitrary analytics builder, comments/reactions, AI summaries, exports, notification delivery, and offline authoritative dashboards.

**Definition of done:** Dashboard totals reconcile with balance APIs; activity is complete, immutable, paginated, authorization-safe, and performant across approved layouts.

**Rollback considerations:** Route users to basic group/balance views, disable projections, preserve events, and rebuild read models rather than editing source history.

## Milestone 11 — Search and analytics

**Goal:** Add bounded, permission-safe discovery and basic descriptive analytics over authoritative data.

**Scope:** Search/filter accessible expenses/activity; category/member/date/status filters; documented sorting/cursors; single-currency spending/contribution summaries.

**Affected areas:** Search/analytics query services, contracts/routes, indexes/read models, responsive filter/results/chart UI, query budgets, and tests.

**Database changes:** Additive indexes/materialized views only after query-plan evidence. Projections remain non-authoritative and rebuildable.

**API work:** Bounded allowlisted filters/sorts, cursor pagination, authorization-before-search, per-currency results, private cache headers, and route-specific rate limits.

**Web/PWA work:** Responsive search/results/filter controls, URL-safe non-sensitive filter state, accessible summaries/charts, and honest empty/error/stale/offline states.

**Tests:** IDOR/search leakage; filter combinations; cursor determinism; malformed/expensive queries; analytics reconciliation; currencies; dates/time zones; query plans; rate limits; responsive accessibility.

**Exclusions:** OCR, AI insights, prediction, exchange rates, budgets, exports, arbitrary reporting, and silent cross-currency aggregation.

**Definition of done:** Only authorized records return within performance bounds; analytics reconcile and state date/currency semantics; UI remains accessible and truthful about partial/unavailable data.

**Rollback considerations:** Disable search/analytics routes and entry points; leave source records untouched; remove disposable projections only in later reviewed cleanup.

## Milestone 12 — Notifications and receipt uploads

**Goal:** Deliver private receipt handling and reliable, preference-aware browser notifications where supported.

**Scope:** GCS signed upload/finalize/read lifecycle; receipt association/replacement/removal; Push API subscription/preferences; transactional outbox; delivery worker/retries/deduplication; capability fallbacks.

**Affected areas:** Receipt/push-subscription/outbox models/migrations, storage/notification adapters, API routes/policies/contracts, worker config, web upload/viewer/permission/deep-link UI, service-worker push handling, GCS CORS/lifecycle, and tests.

**Database changes:** Additive receipt metadata, push subscription, notification preference, outbox/delivery-attempt, and deduplication structures. Binary images remain in private GCS.

**API work:** Signed upload/finalize/read/remove; push subscribe/unsubscribe/preferences; outbox processing; ownership/expiry/limits; no public bucket URLs.

**Web/PWA work:** File selection/upload progress/retry/cancel; authorized viewing; user-gesture permission education; Android/desktop/iOS Home Screen capability detection; safe notification deep links with reauthorization.

**Tests:** Malicious/oversized/mismatched uploads; cross-group IDs; URL scope/expiry; orphan cleanup; duplicate finalization; subscription rotation/account switch; notification dedupe/privacy; unsupported/denied push; deep-link authorization; provider failure.

**Exclusions:** OCR, public receipts, arbitrary files, AI parsing, background financial writes, marketing notifications, and sensitive lock-screen content.

**Definition of done:** Receipts remain private/authorized; metadata is verified; notifications originate from committed outbox events, respect preferences, retry without duplicates, and degrade to in-app state where push is unavailable.

**Rollback considerations:** Disable uploads and push dispatch independently, stop workers, retain metadata/outbox, expire signed operations, and apply lifecycle cleanup only to verified orphan objects.

## Milestone 13 — Testing, deployment and PWA release

**Goal:** Prove production readiness and establish repeatable Next.js/PWA and API delivery on approved infrastructure.

**Scope:** Complete CI/test pyramid; production containers/hosting; environment promotion; migration jobs; Cloud Run/Cloud SQL/Secret Manager/GCS; web hosting/domain/CDN; observability/backups; PWA release/update/rollback runbooks.

**Affected areas:** CI/CD, tests/fixtures, containers/build files, hosting/infrastructure definitions, environment schemas, service-worker release controls, runbooks, dashboards/alerts, and release checklist.

**Database changes:** No feature schema by default. Rehearse pending migrations on a production-shaped restore; execute live migrations only through an explicitly approved, backed-up, least-privileged step.

**API work:** Load/security tests, health/readiness/shutdown, pool sizing, Cloud Run concurrency/timeouts, logs/metrics, staged revision rollout, and compatibility with supported PWA versions.

**Web/PWA work:** Production Next.js hosting, HTTPS/domain, cache/CDN headers, manifest/icon/install/update/offline validation, push/deep links, responsive/accessibility/performance/security testing, and staged web release.

**Tests:** Full lint/type/unit/integration/contract/build matrix; migration/rollback; critical E2E; authorization/IDOR; financial invariants; uploads/push; load/soak; backup restore; secret/redaction; browser/install/service-worker matrix.

**Exclusions:** Unapproved production launch, new product features, native apps/app stores, destructive legacy data cleanup, ad hoc credentials, and bypassing failed gates.

**Definition of done:** Staging and production releases are reproducible; all gates pass; browser bundles contain no secrets; least privilege/restore/rollback are exercised; PWA limitations and supported matrix are published; launch owners approve.

**Rollback considerations:** Roll back Next.js and Cloud Run revisions compatibly, deploy a forward service-worker cache version, halt workers/feature flags, and follow the tested database forward/restore decision tree.

## Milestone 14 — Later native and advanced enhancements

**Goal:** Evaluate native clients and post-MVP capabilities as independent, evidence-based increments after PWA production maturity.

**Scope:** Candidate slices include Expo/native apps, app-store distribution, receipt OCR, AI categorization/insights, budgets, conversion, recurring expenses, offline financial writes, comments/reactions, exports, QR invitations, and advanced animation.

**Affected areas:** Determined per approved product brief. If native is approved, initialize it in a new dedicated milestone with explicit PWA/API compatibility rather than reviving obsolete assumptions silently.

**Database changes:** Additive and slice-specific. AI/OCR provenance, recurring schedules, exchange rates, or offline conflict metadata require dedicated retention/migration/rollback designs.

**API work:** Versioned bounded endpoints with authorization, idempotency, privacy, cost controls, provenance, and compatibility for existing PWA clients.

**Web/PWA work:** Feature-flagged enhancements with consent, uncertainty, accessibility, offline/conflict states, and graceful fallback. The PWA remains a supported client even if native apps are later added.

**Tests:** Slice-specific unit/integration/E2E/security/performance tests plus the complete financial regression suite; native work adds approved Android/iOS build/device/store tests.

**Exclusions:** Treating candidates as one release, bypassing product approval, unreviewed personal-data sharing, auto-posting generated financial values, weakening invariants, or making native mandatory without a support plan.

**Definition of done:** Each chosen slice has approved scope/metrics, updated contracts/invariants, recorded privacy/security/cost/accessibility risks, tested rollout/rollback, and an independent disable path.

**Rollback considerations:** Disable the individual feature/provider/client rollout, preserve authoritative MVP records, and follow the slice-specific retention/cleanup plan. A failed enhancement must not prevent core PWA expense or settlement use.

## Cross-milestone confirmation gates

Before implementation, owners must confirm open decisions in `docs/PRODUCT_SCOPE.md` and `docs/PWA_REQUIREMENTS.md`, especially browser support, hosting/origins, manifest branding, Clerk linking, invitations/memberships, financial correction permissions, upload policy, Web Push policy, recovery objectives, and launch environments. Decisions that change financial behavior require an update to `docs/FINANCIAL_INVARIANTS.md` before code is written.

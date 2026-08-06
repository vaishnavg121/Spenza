# Spenza Revamp Milestones

## How to use this plan

This is the execution sequence for the mobile and backend revamp. The repository audit and rationale remain in `docs/revamp/`; this document turns them into delivery gates.

- Complete milestones in order unless a reviewed dependency change says otherwise.
- Work on only the explicitly requested milestone. Each milestone may be split into smaller pull requests, but its definition of done remains the gate to the next milestone.
- Keep the legacy Next.js application runnable until Milestone 13 is approved and its parity criteria are met.
- Use additive schema evolution, feature flags, compatibility adapters, and reversible traffic changes so the repository and deployed system remain recoverable.
- Re-run the affected lint, strict type-check, tests, builds, Prisma validation, and security checks at every milestone.
- Do not use this roadmap as authorization to run a production migration, delete legacy code, rotate credentials, or change live infrastructure.

## Milestone 1 — Repository restructuring

**Goal:** Establish a pnpm workspace monorepo without changing product behavior or losing the validated legacy baseline.

**Scope:** Inventory the current tree and secrets hygiene; introduce root workspace/tooling configuration; move or encapsulate the legacy Next.js app in its planned workspace; create only the package boundaries needed by later milestones; preserve Git history where practical.

**Files/areas:** Root `package.json`, `pnpm-workspace.yaml`, lockfile, shared TypeScript/lint configuration, proposed `apps/` and `packages/` boundaries, CI paths, documentation, and the retained legacy web workspace.

**Database changes:** None. The existing Prisma schema and migration history move only if needed as a mechanical path change and must validate identically before and after.

**API work:** No Express product API. Reserve the intended workspace and commands without implementing domain routes.

**Mobile work:** No Expo product application. Reserve the intended workspace only if required to validate workspace layout.

**Tests:** Compare the pre/post legacy lint, strict type-check, Prisma validation, and production build; verify workspace install resolution from the existing lockfile; scan tracked filenames/content patterns for likely secrets without printing values.

**Exclusions:** Product behavior changes, dependency upgrades unrelated to workspace compatibility, schema changes, auth migration, new screens, and live infrastructure changes.

**Definition of done:** Root commands run the retained legacy quality gates; no source behavior changed; CI/docs describe workspace commands; Git status contains only reviewed restructuring changes; a clean checkout can reproduce the baseline with the documented supported runtime.

**Rollback:** Revert the mechanical workspace/path commit and restore the prior lockfile/configuration. No data or live-service rollback is required.

## Milestone 2 — Mobile foundation

**Goal:** Produce a buildable Android/iOS Expo shell with agreed navigation, styling, state, forms, themes, and quality tooling.

**Scope:** Initialize Expo with strict TypeScript and Expo Router; configure NativeWind, TanStack Query, limited Zustand client state, React Hook Form, Zod, Reanimated, SecureStore adapter boundaries, and light/dark/OLED themes; add accessible navigation and placeholder states.

**Files/areas:** `apps/mobile`, mobile app configuration, Expo Router routes/layouts, theme tokens, shared UI foundations, platform assets, EAS configuration templates, and mobile-specific lint/test/build scripts.

**Database changes:** None.

**API work:** Define a typed HTTP-client boundary and local mock/test adapter only. Do not implement backend features or let mobile import Prisma/server code.

**Mobile work:** App shell, tab/stack routing, safe-area handling, error/loading/empty states, theme selection, reduced-motion support, accessible base components, and non-secret environment validation.

**Tests:** Unit/component tests for providers, navigation guards as placeholders, theme persistence, schema parsing, and error boundaries; lint/type-check; Expo configuration validation; Android and iOS development/release bundle smoke checks where the environment permits.

**Exclusions:** Real authentication, groups, expenses, network financial writes, push delivery, receipt uploads, screen redesign beyond the foundation, and app-store release.

**Definition of done:** The shell starts on supported Android and iOS targets, all three themes render accessibly, no server-only dependency enters the mobile bundle, public configuration is documented, and mobile lint/type/tests/build checks pass.

**Rollback:** Remove or disable the isolated mobile workspace and its root-script references; the legacy web workspace remains unaffected.

## Milestone 3 — API foundation

**Goal:** Establish a production-oriented Express TypeScript service with secure defaults, contracts, observability, and test infrastructure.

**Scope:** Create the API workspace; configure strict TypeScript, Express, Zod environment/request validation, Pino redaction, Helmet, explicit CORS, distributed-capable rate-limit abstraction, request IDs, consistent errors, health endpoints, graceful shutdown, Prisma lifecycle, and Supertest/Vitest or Jest.

**Files/areas:** `apps/api`, proposed shared contracts/config packages, Prisma client package boundary, API tests, container files, Cloud Run configuration templates, and root/CI commands.

**Database changes:** None to domain schema. A readiness check may verify database connectivity with a least-privileged account; it must not mutate data.

**API work:** `/health/live`, `/health/ready`, middleware order, response/error envelopes, request ID propagation, validated configuration, and an authenticated-route placeholder that fails closed until Clerk is configured.

**Mobile work:** Point only a development/test client at health/version metadata if useful; no product API integration.

**Tests:** Middleware ordering, error mapping, validation, body limits, CORS allow/deny, rate-limit response, request IDs, redaction, liveness/readiness, graceful shutdown, and container start with safe test configuration.

**Exclusions:** Domain routes, production data mutation, Clerk identity cutover, schema changes, uploads, and deployment traffic changes.

**Definition of done:** API lint/type/tests/build pass; the container listens on Cloud Run's configured host/port; live/readiness semantics are correct; missing secrets fail clearly without exposure; no domain endpoint is accidentally public.

**Rollback:** Remove the isolated API deployment/workspace or scale its unused revision to zero. The legacy application continues serving users.

## Milestone 4 — Authentication and profiles

**Goal:** Implement Clerk authentication from Expo through the API and establish the new profile contract without cutting over legacy identities.

**Scope:** Configure Clerk Expo sign-in/session flows and secure token caching; verify Clerk JWTs in Express; map verified subjects to internal users; expose `GET/PATCH /v1/me`; support approved built-in avatar identifiers; define account-linking states for legacy migration.

**Files/areas:** Mobile auth routes/providers, API auth middleware/policies/profile service, contracts, environment schemas/examples, built-in avatar assets/manifest, and auth/profile tests.

**Database changes:** Additive identity-mapping/profile fields or tables required for new-stack users, with uniqueness and lookup indexes. Do not remove or rewrite Better Auth tables or legacy user identifiers.

**API work:** Auth middleware, internal-user resolution, profile read/update, safe bootstrap behavior, and stable `401`/`403` errors. No group/financial authorization yet.

**Mobile work:** Sign-in/up/out, session restoration, protected navigation, profile editing, avatar selection, loading/error states, and token use through the typed API client.

**Tests:** JWT verification failures and key rotation behavior, wrong issuer/audience/authorized party, missing mapping, profile validation, avatar allowlist, secure-storage adapter, protected navigation, IDOR-negative cases, and logs without tokens/PII.

**Exclusions:** Better Auth removal, automatic production account merging, groups, financial features, social providers not explicitly approved, and bespoke avatar uploads.

**Definition of done:** New test/staging users authenticate on Android/iOS, the API derives identity only from verified JWT claims, profile operations are authorized and validated, secrets are server-side, and the additive database path and rollback are reviewed.

**Rollback:** Disable new auth/profile routes and mobile entry with a feature flag or deployment rollback; retain additive columns/tables unused; leave Better Auth and legacy access intact.

## Milestone 5 — Database identity migration

**Goal:** Safely link eligible legacy Better Auth users to Clerk-backed internal identities and prove data ownership is preserved.

**Scope:** Inspect real staging/production schema state; define matching and ambiguity policy; backfill non-destructive identity links; support controlled dual-read/dual-auth compatibility if required; reconcile users, sessions, accounts, and ownership references; prepare operator runbooks.

**Files/areas:** Prisma schema/migrations, backfill/reconciliation scripts, identity adapter, audit queries, deployment runbook, risk register, and migration tests. Scripts must never print secret or full personal values.

**Database changes:** Additive constraints/indexes and backfill of Clerk subject mappings. Legacy Better Auth tables and identifiers remain. Constraint tightening occurs only after null/duplicate reconciliation proves safe.

**API work:** Resolve migrated and new users consistently, expose safe account-linking error states, and preserve object ownership. Webhook-driven identity updates are verified and idempotent.

**Mobile work:** Handle required reauthentication/account-linking states without exposing matching data. No new product domain capability.

**Tests:** Migration on a sanitized production-shaped copy; duplicate/missing/changed-email cases; ownership counts before/after; webhook replay; rollback rehearsal; Prisma validation; API authorization regression across migrated identities.

**Exclusions:** Dropping Better Auth data, guessing ambiguous matches, rewriting financial history, live migration without backup/approval, and unrelated schema cleanup.

**Definition of done:** Every migrated record has a documented disposition; counts and ownership reconcile; ambiguous accounts are quarantined for manual resolution; backup and rollback are tested; legacy auth remains available until cutover approval.

**Rollback:** Stop new identity writes, revert API traffic/config to the legacy-compatible path, and null/ignore additive links using the reviewed reversal procedure. Restore from the verified backup only if data reconciliation requires it.

## Milestone 6 — Groups and memberships

**Goal:** Deliver authorized group, membership, role, and invitation workflows on the new API and mobile app.

**Scope:** Group create/read/update, group currency selection, membership roles/lifecycle, invitation create/revoke/accept/reject/expiry, owner transfer/last-owner protections, and historical-member access per confirmed policy.

**Files/areas:** Group/membership/invitation Prisma models and migrations, API policies/services/routes/contracts, mobile group and invitation routes/forms, activity events, and tests.

**Database changes:** Additive or adapted group, membership, role, and invitation structures with unique membership constraints, invitation token hashing, expiry/status fields, and indexes. Preserve legacy group data for later verified backfill rather than overwrite it.

**API work:** Versioned group/member/invitation endpoints; role-policy enforcement; cursor lists; transactional membership transitions; idempotent invitation acceptance; immutable activity entries.

**Mobile work:** Group list/detail/create/edit, member list and role-aware actions, invitation entry/accept/reject, currency selection, and complete loading/empty/error states.

**Tests:** Role/IDOR matrix; duplicate membership; expired/revoked/replayed invitation; owner departure; concurrent acceptance; guessed IDs/tokens; pagination; activity creation; Android/iOS flows.

**Exclusions:** Expenses, balances, payments, contacts scraping, QR invitations, receipt uploads, and cross-currency groups.

**Definition of done:** A user can create or join a group and see only authorized groups; every transition is transactional and audited; confirmed owner/member policies are enforced; legacy group records have a documented future migration map.

**Rollback:** Feature-flag new group flows and revert API/mobile deployments. Preserve additive data; do not remove new memberships created by users. Use a compatibility reader if traffic returns to legacy.

## Milestone 7 — Expense split engine

**Goal:** Implement the authoritative, tested expense engine for all MVP split methods and multiple payers.

**Scope:** Expense create/read/edit/void; equal, exact, percentage, and shares allocation; multiple payers; integer-minor-unit validation; deterministic rounding; optimistic concurrency; idempotency; immutable activity.

**Files/areas:** Shared pure financial engine, financial contracts, Prisma expense/revision/payer/allocation/idempotency structures, API services/routes/policies, mobile expense forms/detail/edit flows, and test fixtures.

**Database changes:** Additive financial structures using `BIGINT` minor units, currency, stable allocation order, record version/status, revision/audit links, payer/allocation constraints, idempotency records, and required indexes. Do not alter old financial columns destructively.

**API work:** Expense endpoints and validation from `docs/API_CONVENTIONS.md`; group/member authorization; transactional write plus activity; server-returned allocations; version conflict and idempotent replay behavior.

**Mobile work:** Draft and validate payer/split forms, exact reconciliation feedback, server preview/submit, pending optimistic state with rollback, details/revisions, and explicit void confirmation.

**Tests:** Every example/property in `docs/FINANCIAL_INVARIANTS.md`; large values; malformed minor units; duplicate/ineligible participants; multi-payer totals; retry/concurrency; transaction fault injection; IDOR; mobile form and optimistic rollback.

**Exclusions:** Balance simplification, settlements, currency conversion, recurring/offline writes, OCR, AI categorization, and legacy financial-data cutover unless separately approved within the schema plan.

**Definition of done:** All supported calculations conserve value exactly and deterministically; create/edit/void are authorized, transactional, idempotent/versioned, and audited; no floating-point authoritative money path exists; mobile reconciles to server results.

**Rollback:** Disable new expense writes first, retain read/audit access, and roll back API/mobile code to the prior compatible version. Keep additive financial records and schema; never delete committed user data as rollback.

## Milestone 8 — Balances and settlements

**Goal:** Provide reproducible group balances and auditable settlement/reversal workflows.

**Scope:** Derive per-member net positions from active expense contributions/allocations and settlements; expose group balances; record settlements and linked reversals; optionally present deterministic debt suggestions that do not become ledger truth.

**Files/areas:** Balance projection/service, settlement/reversal models and migrations, API routes/contracts/policies, mobile balances and settlement flows, reconciliation tools, and tests.

**Database changes:** Additive settlement/reversal tables with integer minor units, currency, actor/effective date, idempotency, immutable links, and indexes. Any balance cache/materialized view is disposable and rebuildable.

**API work:** Balance read endpoint; settlement create/read and reversal endpoints; transaction, authorization, idempotency, activity, and concurrency rules; per-currency output.

**Mobile work:** Clear owed/owing direction, member breakdown, settlement form/history/reversal state, server reconciliation, and no implication that Spenza transfers money.

**Tests:** Zero-sum property across random valid sequences; multiple payers; edits/voids; settlement and single reversal; duplicate retries; concurrent writes; mixed-currency rejection; cache rebuild comparison; IDOR and former-member policy.

**Exclusions:** Payment processing, bank links, automatic transfers, currency conversion, settlement deletion, and complex debt optimization presented as authoritative history.

**Definition of done:** Balances reproduce from source records and sum to zero per group/currency; settlements and reversals affect positions exactly once; UI direction is unambiguous; reconciliation checks pass against production-shaped data.

**Rollback:** Disable settlement writes, keep records readable, rebuild/discard projections, and revert API/mobile deployment. Never mutate historical settlements to imitate rollback.

## Milestone 9 — Dashboard and activity

**Goal:** Give members a useful, authorized overview and immutable timeline based on committed domain events.

**Scope:** Dashboard summaries for groups, net positions, unsettled items, and recent activity; paginated activity with typed events and actor/target representations; read models optimized without becoming sources of truth.

**Files/areas:** Dashboard/activity queries and projections, API endpoints/contracts, mobile dashboard/activity routes and components, activity renderer registry, indexes, and tests.

**Database changes:** Additive activity fields/indexes or rebuildable read models. Historical events remain append-only; backfills are deterministic and marked with provenance.

**API work:** Authorized dashboard summary and cursor activity endpoints; per-currency grouping; stable event representations; bounded query plans.

**Mobile work:** Dashboard cards, recent activity, full timeline, refresh/error/empty states, redacted or fallback rendering for inaccessible/deleted referenced objects, and theme/accessibility coverage.

**Tests:** Authorization leakage, cursor stability, event ordering/ties, each financial/member event renderer, per-currency totals, query-count/performance thresholds, inaccessible historical references, and Android/iOS UI states.

**Exclusions:** Arbitrary analytics builder, social reactions/comments, AI summaries, exports, and notification delivery.

**Definition of done:** Dashboard totals reconcile with balance APIs; activity is complete for defined events, immutable, paginated, and authorization-safe; agreed representative datasets meet performance targets.

**Rollback:** Route clients back to basic group/balance views, disable dashboard projections, and preserve all activity rows. Rebuild read models after correction rather than editing source events.

## Milestone 10 — Search and analytics

**Goal:** Add bounded, permission-safe discovery and basic descriptive analytics over authoritative data.

**Scope:** Search/filter accessible expenses and activity; category/member/date/status filters; documented sort/cursors; basic spending and contribution summaries within one currency context.

**Files/areas:** Search/analytics query services, contracts/routes, indexes or rebuildable views, mobile search/filter UI and charts, query budgets, and tests.

**Database changes:** Additive indexes/materialized views only after query-plan evidence. No denormalized value becomes authoritative, and every projection has a rebuild/reconciliation procedure.

**API work:** Bounded search and analytics endpoints with allowlisted filters/sorts, cursor pagination, authorization applied before search, per-currency results, and safe rate limits.

**Mobile work:** Search entry/results, filter controls, recent/cleared query state, empty/error states, and accessible basic charts/summaries that never combine currencies silently.

**Tests:** IDOR/search leakage, filter combinations, cursor determinism, malformed/expensive queries, analytics reconciliation, currency separation, date boundary/timezone cases, index/query-plan thresholds, and rate limiting.

**Exclusions:** OCR, AI insights, prediction, exchange rates, budgets, exports, arbitrary SQL/reporting, and cross-group global amounts that mix currencies.

**Definition of done:** Search returns only authorized records within performance bounds; analytics reconcile to source queries and state their date/currency semantics; mobile output is accessible and honest about empty/partial data.

**Rollback:** Disable search/analytics routes and UI entry points; drop only disposable projections in a later reviewed cleanup, leaving source records untouched.

## Milestone 11 — Notifications and receipt uploads

**Goal:** Deliver private receipt-image handling and reliable, preference-aware push notifications.

**Scope:** GCS signed upload/finalize/read lifecycle; receipt association/replacement/removal; Expo device-token registration and preferences; transactional outbox events; provider delivery worker, retries, deduplication, and minimal payloads.

**Files/areas:** Receipt/device/outbox Prisma models and migrations, storage/notification adapters, API routes/policies/contracts, worker configuration, mobile image picker/upload/viewer and notification setup, GCS lifecycle/CORS, and tests.

**Database changes:** Additive receipt metadata, device registration, notification preference, outbox/delivery-attempt, and deduplication structures. Binary images remain in private GCS, not PostgreSQL.

**API work:** Authorized signed upload request/finalize/read/remove; device register/unregister/preferences; outbox processing; ownership checks; expiry and limits; no public bucket URLs.

**Mobile work:** Permission education, device registration refresh, preference controls, receipt selection/compression where approved, progress/retry/cancel, authorized viewing, notification deep links with post-navigation authorization refresh.

**Tests:** Malicious/oversized/mismatched uploads; guessed/cross-group receipt IDs; signed URL scope/expiry; orphan cleanup; duplicate finalization; revoked device tokens; notification dedupe/retry; privacy-safe payload/logs; deep-link auth; provider failure.

**Exclusions:** OCR, public receipts, arbitrary files, AI parsing, background offline financial writes, marketing notifications, and notification content with sensitive lock-screen details.

**Definition of done:** Receipts remain private and authorized end to end; object metadata is verified before association; notifications originate from committed outbox events, respect preferences, and retry without duplicates; secrets/URLs/tokens are redacted.

**Rollback:** Disable new uploads and notification dispatch, stop workers, retain metadata/outbox for recovery, expire signed operations, and revert client/API deployment. Apply lifecycle cleanup only to verified orphan objects.

## Milestone 12 — Testing and deployment

**Goal:** Prove release readiness and establish repeatable delivery to EAS and Google Cloud Run/Cloud SQL/GCS/Secret Manager.

**Scope:** Complete test pyramid and CI gates; production containers; environment promotion; migration job separation; Cloud Run service; Cloud SQL connectivity; Secret Manager injection; bucket/service accounts; EAS profiles; observability, backups, restore, rollout, and incident runbooks.

**Files/areas:** CI/CD workflows, test suites/fixtures, container/build files, infrastructure definitions or reviewed scripts, EAS configuration, environment schemas/examples, runbooks, dashboards/alerts, and release checklist.

**Database changes:** No feature schema by default. Rehearse all pending migrations on a production-shaped restore; execute live migrations only through an explicitly approved, backed-up, least-privileged deployment step.

**API work:** Load/security testing, health/readiness, shutdown, connection-pool sizing, Cloud Run concurrency, timeouts, structured logging/metrics, and staged revision/traffic rollout.

**Mobile work:** Android/iOS release builds, environment separation, signing/credential handling through approved systems, deep-link/push checks, accessibility/performance/crash testing, and staged internal distribution.

**Tests:** Full lint/type/unit/integration/contract/build matrix; migration and rollback rehearsal; end-to-end critical journeys; authorization/IDOR suite; financial invariant suite; upload/notification tests; load/soak thresholds; backup restore and reconciliation; secret/redaction checks.

**Exclusions:** Unapproved production launch, new product features, legacy deletion, ad hoc credential sharing, and bypassing failed quality/security gates.

**Definition of done:** A documented pipeline reproducibly builds and deploys isolated staging releases; all gates pass; production configuration contains no mobile secrets; least privilege is reviewed; backup restore and rollback are exercised; launch approval criteria and owners are explicit.

**Rollback:** Shift Cloud Run traffic to the last healthy compatible revision, halt mobile rollout through store/EAS controls, disable affected flags/workers, and follow the tested database forward/restore decision tree. Preserve evidence and notify owners.

## Milestone 13 — Legacy removal

**Goal:** Remove the legacy Next.js/Better Auth path only after replacement parity, migration, and rollback evidence are approved.

**Scope:** Final feature/data reconciliation; freeze legacy writes; observe the new stack through the agreed stability window; archive necessary history/docs; remove legacy source, dependencies, routes, configuration, and eventually obsolete auth/database structures through separate reviewed cleanup.

**Files/areas:** Legacy web workspace, Better Auth integration, obsolete packages/scripts/env variables, compatibility adapters, deployment configuration, archived documentation, Prisma cleanup migrations, and final reuse matrix.

**Database changes:** Cleanup is last and separately reviewed. Drop obsolete columns/tables only after verified backups, retention/privacy review, zero-read/write telemetry, reconciliation, and a tested restore path. Never edit historical migrations.

**API work:** Remove temporary compatibility/dual-read paths after telemetry confirms no clients depend on them; keep stable `v1` contracts for supported mobile versions.

**Mobile work:** Enforce minimum supported version only through an approved release policy; ensure current store builds no longer depend on legacy endpoints.

**Tests:** Full regression/e2e; legacy/new record-count and financial reconciliation; production access-log dependency checks; rollback drill before destructive cleanup; cold restore; secret/config reference scan; repository build from clean checkout.

**Exclusions:** New features, opportunistic redesign, unrelated dependency upgrades, immediate destruction after cutover, and removal based only on code inspection.

**Definition of done:** Product/security/data owners approve parity; new stack meets the stability window; no supported client or job calls legacy services; required records are retained; source/config cleanup passes all gates; destructive database cleanup, if approved, is independently documented and recoverable.

**Rollback:** Before destructive cleanup, re-enable legacy read/write routing using the rehearsed compatibility path. After cleanup, restore the archived deployment and database backup to an isolated environment, reconcile, and execute the approved recovery plan rather than improvising schema changes.

## Milestone 14 — Later enhancements

**Goal:** Evaluate and deliver post-MVP capabilities as independently approved, privacy-conscious increments after the core system is stable.

**Scope:** Candidate slices are receipt OCR, AI categorization/insights, budget prediction, currency conversion, recurring expenses, offline financial writes, comments/reactions, PDF/spreadsheet exports, QR invitations, advanced animation, and additional themes. Each candidate requires its own product brief and technical/security review.

**Files/areas:** Determined per approved slice. Experimental providers and models stay behind interfaces/feature flags and outside the authoritative financial engine unless a separate invariant update is approved.

**Database changes:** Additive and slice-specific. AI/OCR provenance, recurring schedules, exchange-rate sources, offline conflict metadata, or social/export data require dedicated retention, migration, and rollback designs before schema work.

**API work:** Versioned, bounded endpoints with explicit authorization, idempotency, privacy, cost controls, and provenance. Generated suggestions never silently mutate financial records.

**Mobile work:** Feature-flagged experiences with clear consent, uncertainty, accessibility, offline/conflict states where relevant, and graceful fallback when providers are unavailable.

**Tests:** Slice-specific unit/integration/e2e/security/performance tests plus the complete financial regression suite. AI/OCR features need evaluation datasets and human-confirmation paths; currency conversion needs rate-source/time/rounding tests; offline writes need conflict/replay tests.

**Exclusions:** Treating this list as one release, bypassing product approval, unreviewed personal-data sharing, auto-posting generated financial values, or weakening MVP invariants.

**Definition of done:** For each chosen slice, scope and success metrics are approved; privacy/security/cost/accessibility risks are recorded; contracts and invariants are updated; rollout and rollback are tested; feature flags allow safe disablement. Unselected candidates remain unimplemented.

**Rollback:** Disable the individual feature flag/provider, stop its jobs, preserve authoritative MVP records, and apply the slice's approved data-retention/cleanup plan. A failed enhancement must not prevent core expense or settlement operation.

## Cross-milestone confirmation gates

Before beginning implementation, owners must confirm the open decisions in `docs/PRODUCT_SCOPE.md`, especially supported currencies, Clerk account linking, invitation/member lifecycle, financial correction permissions, upload policy, notification defaults, recovery objectives, and launch environments. Decisions that change financial behavior require an update to `docs/FINANCIAL_INVARIANTS.md` before code is written.

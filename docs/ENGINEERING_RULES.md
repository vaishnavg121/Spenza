# Spenza Engineering Rules

## Interpretation

The words **must**, **must not**, **should**, and **may** are normative. A deviation from a **must** requires a documented architecture decision, tests covering the risk, and explicit review.

## Approved technology baseline

- Workspace: pnpm workspace monorepo.
- Web/PWA: Next.js App Router, React, strict TypeScript, Tailwind CSS, the existing accessible UI component system where suitable, TanStack Query, React Hook Form, Zod, responsive mobile-first design, Web App Manifest, Service Worker APIs, and standards-based Web Push where supported.
- API: Node.js, Express, strict TypeScript, Prisma, PostgreSQL, Zod, Clerk JWT verification, Pino, Helmet, explicit CORS, rate limiting, Vitest, and Supertest.
- Infrastructure: the approved Google Cloud SQL PostgreSQL instance, Cloud Run for the API, private Google Cloud Storage for receipts, Google Secret Manager for production secrets, and an approved HTTPS-capable Next.js hosting platform.

A native Expo application is not part of the MVP baseline. Changing a baseline choice requires a documented need, compatibility/security assessment, migration impact, and explicit approval. A library may be wrapped or omitted from a feature that does not need it; this list is not permission to add unused dependencies.

## Architecture boundaries

- Browser and installed-PWA code communicates only with the versioned HTTP API. It must never contain a PostgreSQL connection string, Prisma Client, or direct database access.
- The existing Next.js server-side Prisma/Server Action paths are transitional. Move each product slice behind the Express API before that slice is considered production-ready; the final `apps/web` dependency graph must not reach the database package.
- The API owns authentication mapping, object authorization, validation, financial calculations, transactions, and persistence.
- Shared packages may contain platform-neutral schemas, types, and pure domain logic. They must not expose Prisma, database credentials, Express internals, service-worker globals, or browser-only modules across the wrong boundary.
- PostgreSQL remains the system of record. Browser storage, service-worker caches, TanStack Query caches, notifications, logs, and analytics views are not authoritative financial stores.
- Each workspace must expose clear lint, strict type-check, test, and build commands through the pnpm workspace.

## TypeScript and validation

- TypeScript strict mode is mandatory in every new workspace. Preserve or improve strictness in retained code.
- Do not suppress type or lint failures with `@ts-ignore`, `@ts-expect-error`, disabled rules, unsafe casts, or unexplained `any`.
- An unavoidable third-party `any` boundary must be isolated, explained in code, and immediately narrowed to an `unknown`-based validated type.
- Use Zod at untrusted boundaries: HTTP bodies, path/query parameters, environment variables, browser storage, push payloads, storage metadata, webhook payloads, and persisted JSON.
- Infer types from one canonical schema where practical. Do not maintain divergent handwritten request, response, and validation types.
- Treat nullable, optional, absent, empty, offline, stale, and unsaved states as distinct states and model them deliberately.

## Authentication and authorization

- The API must cryptographically verify Clerk tokens. Client-side route protection and Next.js middleware are user experience and defense in depth, not object authorization.
- Every protected operation must authorize the actor against the concrete object being read or changed. A valid token alone is insufficient.
- Authorization rules belong in reusable backend policy/service code and must have negative tests.
- Database identifiers supplied by a browser must be treated as untrusted. Queries must scope them to the authorized actor or group.
- Clerk-managed browser sessions or short-lived tokens must not be copied into `localStorage`, `sessionStorage`, IndexedDB, service-worker caches, logs, or analytics.
- Cookie-authenticated endpoints require CSRF protection and reviewed SameSite/origin behavior. Bearer-token endpoints require strict CORS and must not treat CORS as authorization.

## Financial correctness

- Follow `docs/FINANCIAL_INVARIANTS.md` for every expense, payer, split, balance, settlement, edit, void, reversal, and financial aggregate.
- Store and calculate monetary values as integer minor units. Never use JavaScript floating point for stored money or authoritative arithmetic.
- Financial writes must use PostgreSQL transactions and leave the database either fully updated or unchanged.
- Retryable financial commands must be idempotent. Concurrent edits must use an explicit version or equivalent optimistic-concurrency check.
- Rounding must be deterministic and reconcile exactly to the source amount.
- Every financial change must append immutable activity/audit data in the same transaction as the domain write.
- Financial writes are online-only in MVP. Do not use service-worker Background Sync, browser mutation persistence, or offline queues for create/edit/void/settlement operations.
- All financial calculation paths require unit tests, including boundary and remainder cases. Protected writes require integration tests.

## Database and migrations

- Prisma schema changes require reviewed migrations. Do not use `db push` as a production migration mechanism.
- Migrations must be additive by default: add nullable/defaulted structures, backfill, verify, switch reads/writes, then remove obsolete structures in a later reviewed cleanup.
- A destructive migration requires a verified backup, impact analysis, staged rollout, data-reconciliation query, and tested rollback or restore plan.
- Application deployments must tolerate the immediately previous compatible schema during rolling deployment.
- Runtime and migration database identities must be separate and least-privileged.
- Do not rewrite historical migration files that have been applied to a shared environment.

## API and service behavior

- Follow `docs/API_CONVENTIONS.md` for paths, envelopes, errors, pagination, dates, money, idempotency, request IDs, and cache controls.
- Route handlers should coordinate; domain rules belong in tested services or pure functions; Prisma access belongs behind a clear persistence boundary.
- Do not expose Prisma records directly as public responses. Map them to explicit API representations.
- Avoid N+1 queries, unbounded list endpoints, and hidden network work in serializers.
- Use Pino structured logs, propagate request IDs, and redact secrets and sensitive data according to `docs/SECURITY.md`.
- Health endpoints must distinguish process liveness from dependency readiness.

## Web and PWA behavior

- Next.js App Router owns application routing, rendering boundaries, metadata, and the web manifest. Use Server and Client Components deliberately according to the installed Next.js documentation.
- TanStack Query owns client-side server-state fetching and cache lifecycle. Do not duplicate API entities into ad hoc global stores.
- React Hook Form and Zod own interactive form state and validation. The API still revalidates everything.
- Use the existing accessible UI primitives when they remain suitable; wrap and harden them instead of replacing them without evidence.
- Build mobile-first layouts that expand to tablet and desktop. Responsive behavior must not remove information or actions available at another breakpoint.
- Use semantic HTML, visible focus, keyboard navigation, screen-reader labels, reduced-motion support, sufficient contrast, and touch targets defined in `docs/PWA_REQUIREMENTS.md`.
- Service-worker behavior must follow an allowlisted caching policy. Never cache private API responses, auth routes/callbacks, signed receipt URLs, mutation responses, or user-specific server-rendered HTML.
- An offline screen is a truthful degraded state, not an offline financial application. Draft preservation, if later approved, remains explicitly unsaved and is never automatically submitted.
- Treat `NEXT_PUBLIC_*` and all browser-delivered configuration as public. They may contain public endpoints or identifiers, never secrets.
- Installation, Web Push, badges, and standalone mode require capability detection and graceful fallback. Core online use must work without installation or notification permission.

## Security, privacy, and dependencies

- Follow `docs/SECURITY.md`; prefer deny-by-default policies and least privilege.
- Validate file type, size, ownership, and storage key for uploads. Buckets remain private.
- Do not log authorization headers, cookies, tokens, secret values, signed URLs, push subscription keys, or full sensitive payloads.
- Add dependencies only for a demonstrated need. Check Next.js, React, browser, CSP, and service-worker compatibility and avoid duplicate libraries for the same responsibility.
- Pin and review high-risk build, authentication, database, PWA, upload, and cryptography dependencies. Address critical advisories through a focused change.

## Change discipline

- Inspect existing code, documentation, Git status, and installed framework documentation before changing behavior.
- Work within one requested milestone. Avoid unrelated refactors, dependency updates, formatting churn, and drive-by cleanup.
- Promote `apps/web-legacy` to `apps/web` mechanically before broader web changes; preserve the validated build throughout the rename.
- Preserve working behavior until its hardened replacement is tested against agreed parity criteria.
- Keep every milestone buildable and deployable. Use feature flags or additive routing when a replacement cannot safely launch at once.
- Never expose credentials in source, fixtures, screenshots, output, commits, browser bundles, manifests, or documentation.

## Required verification and handoff

For affected workspaces, run and report:

1. lint;
2. strict TypeScript checking;
3. unit and integration tests appropriate to the change;
4. production builds;
5. manifest, service-worker, offline, update, responsive, accessibility, and installation checks for PWA changes;
6. Prisma validation and migration checks when database files change;
7. security and authorization tests for protected operations.

The handoff must list files changed, commands and results, migrations and rollback considerations, security-sensitive decisions, assumptions, unverified behavior, and remaining blockers. A milestone is not complete merely because code compiles.

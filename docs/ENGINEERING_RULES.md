# Spenza Engineering Rules

## Interpretation

The words **must**, **must not**, **should**, and **may** are normative. A deviation from a **must** requires a documented architecture decision, tests covering the risk, and explicit review.

## Approved technology baseline

- Workspace: pnpm workspace monorepo.
- Mobile: Expo, React Native, strict TypeScript, Expo Router, NativeWind, TanStack Query, Zustand, React Hook Form, Zod, Clerk Expo, React Native Reanimated, Expo SecureStore, Expo Notifications, and EAS Build.
- API: Node.js, Express, strict TypeScript, Prisma, PostgreSQL, Zod, Clerk JWT verification, Pino, Helmet, explicit CORS, rate limiting, and Vitest or Jest with Supertest.
- Infrastructure: the approved Google Cloud SQL PostgreSQL instance, Cloud Run for the API, private Google Cloud Storage for receipts, and Google Secret Manager for production secrets.

Changing a baseline choice requires a documented need, compatibility/security assessment, migration impact, and explicit approval. A library may be wrapped or omitted from a feature that does not need it; this list is not permission to add unused dependencies.

## Architecture boundaries

- The Expo application communicates only with the versioned HTTP API. It must never contain a PostgreSQL connection string, Prisma Client, or direct database access.
- The API owns authentication mapping, authorization, validation, financial calculations, transactions, and persistence.
- Shared packages may contain platform-neutral schemas, types, and pure domain logic. They must not leak Node-only modules into the mobile bundle or mobile modules into the API.
- PostgreSQL remains the system of record. Redis, local state, query caches, notifications, logs, and analytics views are not authoritative financial stores.
- Each workspace must expose clear lint, strict type-check, test, and build commands through the pnpm workspace.

## TypeScript and validation

- TypeScript strict mode is mandatory in every new workspace. Preserve or improve strictness in retained code.
- Do not suppress type or lint failures with `@ts-ignore`, `@ts-expect-error`, disabled rules, unsafe casts, or unexplained `any`.
- An unavoidable third-party `any` boundary must be isolated, explained in code, and immediately narrowed to an `unknown`-based validated type.
- Use Zod at untrusted boundaries: HTTP bodies, path/query parameters, environment variables, storage metadata, webhook payloads, and persisted JSON.
- Infer types from one canonical schema where practical. Do not maintain divergent handwritten request, response, and validation types.
- Treat nullable, optional, absent, and empty values as distinct states and model them deliberately.

## Authentication and authorization

- The API must cryptographically verify Clerk tokens. Client-side route protection is user experience, not security.
- Every protected operation must authorize the actor against the concrete object being read or changed. A valid token alone is insufficient.
- Authorization rules belong in reusable backend policy/service code and must have negative tests.
- Database identifiers supplied by a client must be treated as untrusted. Queries must scope them to the authorized actor or group.

## Financial correctness

- Follow `docs/FINANCIAL_INVARIANTS.md` for every expense, payer, split, balance, settlement, edit, void, reversal, and financial aggregate.
- Store and calculate monetary values as integer minor units. Never use JavaScript floating point for stored money or authoritative arithmetic.
- Financial writes must use PostgreSQL transactions and leave the database either fully updated or unchanged.
- Retryable financial commands must be idempotent. Concurrent edits must use an explicit version or equivalent optimistic-concurrency check.
- Rounding must be deterministic and reconcile exactly to the source amount.
- Every financial change must append immutable activity/audit data in the same transaction as the domain write.
- All financial calculation paths require unit tests, including boundary and remainder cases. Protected writes require integration tests.

## Database and migrations

- Prisma schema changes require reviewed migrations. Do not use `db push` as a production migration mechanism.
- Migrations must be additive by default: add nullable/defaulted structures, backfill, verify, switch reads/writes, then remove obsolete structures in a later reviewed cleanup.
- A destructive migration requires a verified backup, impact analysis, staged rollout, data-reconciliation query, and tested rollback or restore plan.
- Application deployments must tolerate the immediately previous compatible schema during rolling deployment.
- Runtime and migration database identities must be separate and least-privileged.
- Do not rewrite historical migration files that have been applied to a shared environment.

## API and service behavior

- Follow `docs/API_CONVENTIONS.md` for paths, envelopes, errors, pagination, dates, money, idempotency, and request IDs.
- Route handlers should coordinate; domain rules belong in tested services or pure functions; Prisma access belongs behind a clear persistence boundary.
- Do not expose Prisma records directly as public responses. Map them to explicit API representations.
- Avoid N+1 queries, unbounded list endpoints, and hidden network work in serializers.
- Use Pino structured logs, propagate request IDs, and redact secrets and sensitive data according to `docs/SECURITY.md`.
- Health endpoints must distinguish process liveness from dependency readiness.

## Mobile behavior

- Expo Router owns navigation; TanStack Query owns server-state fetching and cache lifecycle; Zustand is limited to small client-only state.
- React Hook Form and Zod own form state and validation. The API still revalidates everything.
- Store authentication/session material only through Clerk-supported secure storage backed by Expo SecureStore. Do not put tokens in AsyncStorage, Zustand persistence, logs, or analytics.
- Optimistic financial UI is provisional and must reconcile with the server response or roll back visibly.
- Do not queue offline financial mutations in MVP. A failed or offline write must remain clearly unsaved.
- Use Reanimated for purposeful motion while respecting reduced-motion preferences. All three themes must meet accessibility contrast expectations.
- Treat `EXPO_PUBLIC_*` values as public. They may contain identifiers or public endpoints, never secrets.

## Security, privacy, and dependencies

- Follow `docs/SECURITY.md`; prefer deny-by-default policies and least privilege.
- Validate file type, size, ownership, and storage key for uploads. Buckets remain private.
- Do not log authorization headers, cookies, tokens, secret values, signed URLs, or full sensitive payloads.
- Add dependencies only for a demonstrated need. Check React Native compatibility before adding a shared/mobile dependency and avoid duplicate libraries for the same responsibility.
- Pin and review high-risk build, authentication, database, upload, and cryptography dependencies. Address critical advisories through a focused change.

## Change discipline

- Inspect existing code, documentation, Git status, and relevant framework documentation before changing behavior.
- Work within one requested milestone. Avoid unrelated refactors, dependency updates, formatting churn, and drive-by cleanup.
- Preserve legacy behavior until the replacement is tested against agreed parity criteria.
- Keep every milestone buildable and deployable. Use feature flags or additive routing when a replacement cannot safely launch at once.
- Never expose credentials in source, fixtures, screenshots, output, commits, or documentation.

## Required verification and handoff

For affected workspaces, run and report:

1. lint;
2. strict TypeScript checking;
3. unit and integration tests appropriate to the change;
4. production builds;
5. Prisma validation and migration checks when database files change;
6. security and authorization tests for protected operations.

The handoff must list files changed, commands and results, migrations and rollback considerations, security-sensitive decisions, assumptions, unverified behavior, and remaining blockers. A milestone is not complete merely because code compiles.

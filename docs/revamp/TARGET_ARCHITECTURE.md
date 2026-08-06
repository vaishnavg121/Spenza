# Spenza Target Architecture

## Architecture outcome

Spenza becomes a responsive, installable Progressive Web App built on the existing Next.js App Router application, backed by a separately deployable Express API. The browser communicates only with the HTTPS API. Prisma and Cloud SQL credentials exist only in the API/database runtime after each domain slice is migrated.

The Next.js workspace now lives at `apps/web` following its mechanical promotion from `apps/web-legacy`. Its working routes, accessible UI foundations, forms, copy, and product flows are retained where safe. Unsafe authorization, financial arithmetic, direct Prisma access, and tightly coupled Server Actions are replaced incrementally behind versioned API contracts.

```text
Browser tab or installed PWA
  -> Next.js App Router renders the responsive application
  -> Clerk establishes a supported web session
  -> HTTPS /v1 API request with short-lived verified identity
  -> Express verifies Clerk JWT and resolves the internal user
  -> Policy + domain services authorize and validate the command
  -> Prisma transaction accesses Cloud SQL PostgreSQL

Browser -> authorized signed upload request -> private Google Cloud Storage
API/outbox -> Web Push delivery worker -> browser push service -> service worker
```

The PWA service worker is a delivery/performance boundary, not a financial data store. It caches only allowlisted public/static resources and the offline fallback. Financial writes remain online-only.

## Proposed monorepo

```text
/
├─ apps/
│  ├─ web/                    # promoted Next.js responsive PWA
│  ├─ api/                    # Express/Cloud Run service
│  └─ mobile/                 # temporary empty placeholder; remove after strategy confirmation
├─ packages/
│  ├─ contracts/              # platform-neutral Zod HTTP DTOs/errors/pagination
│  ├─ domain/                 # pure split, balance, currency, and policy logic
│  ├─ database/               # Prisma schema/client/migrations; API-only exports
│  ├─ config/                 # shared TS/ESLint/Prettier config; no secrets
│  └─ test-utils/             # factories and deterministic fixtures
├─ infra/                     # reviewed hosting/Cloud Run/Cloud SQL/GCS definitions
├─ docs/
├─ pnpm-workspace.yaml
└─ package.json
```

Workspace dependency rules:

- `apps/web` may depend on `contracts` and browser-safe pure utilities. It must not depend on `database`, Prisma, Express internals, or server secrets.
- `apps/api` may depend on `contracts`, `domain`, and `database`.
- `database` is unreachable from the web dependency graph after migration.
- `contracts` imports no Express, Prisma, Node-only, Next.js, browser-only, or provider SDK modules.
- Service-worker code imports only browser/worker-safe modules and no UI/server packages.
- Root scripts orchestrate lint, typecheck, tests, builds, dependency boundaries, and PWA checks with pnpm filters.

## Web application and PWA

### Next.js foundation

- Use Next.js App Router and strict TypeScript.
- Preserve Server/Client Component boundaries according to the installed Next.js documentation.
- Use server rendering where it improves initial experience without caching private data incorrectly.
- Route all migrated product data through the Express API. Server-side Next.js fetches may call the API but do not access Prisma directly.
- Keep public marketing/static pages separable from authenticated application routes for caching and security policy.
- The completed mechanical promotion to `apps/web` precedes responsive/PWA/domain changes so rename failures remain distinguishable from product changes.

### UI and state

- Tailwind CSS and existing accessible UI components remain the foundation where suitable.
- Use semantic HTML and component wrappers that enforce accessible names, focus management, keyboard interaction, contrast, reduced motion, and touch targets.
- Build mobile-first layouts with content-driven phone/tablet/desktop breakpoints and bounded desktop widths.
- TanStack Query owns browser server-state cache/invalidation/retry behavior.
- React Hook Form plus Zod own client form state and validation; the API revalidates every request.
- Keep client-only state small and local. Do not persist authoritative entities or tokens in browser storage.
- Light, dark, and OLED themes use semantic tokens and work in normal tabs and standalone display mode.

### Routing and rendering

- Public: landing, sign-in/up, verification/recovery/provider callback.
- Authenticated: dashboard, groups, activity, search, and profile.
- Nested routes: group details, members/invitations, expense create/detail/edit, balances/settlements, receipts.
- Links: Clerk callbacks, invitation links, activity/notification targets, and normal external URLs.
- Installed standalone mode preserves in-scope navigation and opens unrelated external origins through normal browser behavior.

### PWA delivery boundary

- App name and short name are `Spenza`; manifest `id`, `start_url`, and `scope` are `/`; display mode is `standalone`.
- Provide approved 192px/512px icons, a maskable 512px icon, Apple touch icons, and favicon.
- Production requires HTTPS; localhost is the development exception.
- Register a minimal service worker at the application root with explicit versioning and rollback behavior.
- Cache immutable hashed static assets, approved public resources, and a data-free offline fallback only.
- Never service-worker-cache authenticated API responses, auth callbacks, cookies/tokens, user-specific HTML/RSC payloads, signed URLs, receipts, uploads, push subscriptions, or mutations.
- Do not use Background Sync or persisted mutation queues for financial writes.
- Update UX activates a waiting version only at a safe boundary and prevents reload loops or mid-write activation.
- Installation and Web Push use feature detection and degrade to the full responsive browser experience.

### Client/API boundary

- One typed API client adds Clerk-supported short-lived authorization, request IDs, web build version, timeouts, and typed error decoding.
- Query keys are centralized and entity-aware.
- Financial commands generate an idempotency key once per explicit online intent and include last-seen versions for edits.
- Optimistic UI is provisional, labeled pending, and rolled back on failure.
- Browser calculations are previews. The API returns authoritative allocations and balances.
- An offline action remains unsaved; it is not scheduled for later replay.

## API service

### Runtime and structure

- Pin one supported Node.js LTS in engines, containers, CI, and local tooling.
- Express uses strict TypeScript.
- Layers are route → request/auth middleware → controller → domain service/policy → repository/Prisma.
- Controllers translate HTTP only. Domain rules have no Express/Prisma dependency.
- Versioned routes live under `/v1`; `/health/live` and `/health/ready` remain unversioned.

Suggested middleware order:

1. Reviewed trust-proxy policy and request ID.
2. Pino HTTP logging with secret/PII redaction.
3. Helmet and explicit security headers.
4. Environment-based CORS allowlist.
5. Body limits and JSON parsing.
6. Global and route-sensitive distributed rate limiting.
7. Clerk JWT verification.
8. Internal user resolution and request context.
9. Zod request validation.
10. Routes/controllers.
11. Typed not-found and centralized error handlers.

### Contracts and cache behavior

- JSON DTOs live in `packages/contracts` and validate at both boundaries.
- Financial values cross JSON as base-10 minor-unit strings, never IEEE-754 numbers.
- Currency codes are explicit on every monetary aggregate; timestamps are ISO 8601 UTC.
- Collections use cursor pagination and bounded allowlisted filters/sorts.
- Errors contain stable codes, safe messages, request IDs, and optional field details.
- Protected/user-specific responses default to `Cache-Control: private, no-store`.
- `Idempotency-Key` is required for financial create/settlement/upload-finalization commands; versions protect edits/voids.

### Representative endpoint surface

| Domain | Representative endpoints |
| --- | --- |
| Identity | `GET/PATCH /v1/me`, Clerk webhook endpoint |
| Groups | list/create/get/update/archive, invitations, members, roles, leave/remove |
| Expenses | list/create/get/update/void, allocation preview, receipt attach/detach |
| Balances | authorized group/member summaries and optional debt suggestions |
| Settlements | create/read/reverse and history |
| Dashboard/activity | currency-scoped summary and cursor activity |
| Search/analytics | bounded authorized filters and descriptive summaries |
| Uploads | signed upload request, finalize, read, replace/remove |
| Notifications | push subscribe/unsubscribe/preferences and in-app notification state |

Generate OpenAPI from the reviewed contract source or validate it against that source in CI.

## Authentication and authorization

### Clerk flow

1. The Next.js application uses Clerk's supported web integration to establish a browser session.
2. Browser API calls obtain a short-lived session token through the supported SDK boundary and send it to Express.
3. Express verifies signature, issuer, audience/authorized party, expiry, and required claims.
4. Express maps Clerk `sub` to unique `clerkUserId` on the stable internal user.
5. Domain authorization uses internal user/resource membership, never browser-supplied identity.
6. Clerk webhooks update approved identity fields through signature verification and idempotent event storage.

Clerk authenticates identity; Spenza owns authorization. Client route guards, SSR redirects, CORS, and opaque IDs do not replace backend policy checks.

### Browser session rules

- Do not persist tokens in localStorage, sessionStorage, IndexedDB, service-worker caches, TanStack Query, logs, or analytics.
- Use secure HttpOnly cookies where provided by the supported flow and apply reviewed SameSite/origin/CSRF behavior.
- Clear account-scoped queries, drafts, push subscription associations, and visible state on sign-out/account switch.
- Do not cache authenticated HTML or RSC responses in shared CDN/service-worker storage.

### Identity migration

- Internal `User.id` remains the stable foreign key for history.
- `clerkUserId` is unique/provider-specific; email is not the durable foreign key after linking.
- Better Auth data remains available during transition and is archived/dropped only under approved retention/rollback gates.
- Password hashes, sessions, tokens, and verification records are not copied to Clerk.

## Data architecture

The existing conceptual models seed the target, but financial and identity foundations require additive redesign.

- Persist/calculate money as approved integer minor units in PostgreSQL `BIGINT` and TypeScript `bigint`, serialized as strings.
- Store deterministic payment/allocation rows and stable remainder order.
- Financial deletion is void/reversal with immutable history; group deletion is archival.
- Enforce one group currency in MVP and reject mixed-currency operations.
- Add idempotency, versions, actors, timestamps, constraints, and measured indexes.
- Use explicit `ExpensePayment`, `ExpenseAllocation`, optional revision/void metadata, settlement reversal links, receipt metadata, push subscriptions, notification/outbox delivery, and webhook deduplication.
- Keep `packages/database` as the sole Prisma schema/client/migration source when that move is approved.
- Production releases run reviewed `prisma migrate deploy` through a controlled job, never development migrations at app startup.

## Infrastructure

### Next.js hosting

- Select an HTTPS-capable host that supports the required App Router rendering/runtime behavior, immutable static assets, reviewed cache headers, environment isolation, observability, staged rollback, and custom domains.
- Vercel or a containerized/server runtime such as Cloud Run may be evaluated; no provider is selected by this document.
- The web host receives only necessary web-runtime configuration and public values. It must not own database migration or GCS signing privileges once API extraction is complete.
- Decide same-origin proxy versus cross-origin API topology before Clerk/CORS/CSRF implementation.

### Cloud Run API

- Use a multi-stage non-root container with reproducible pnpm install, health checks, graceful shutdown, and bounded resource/concurrency settings.
- A dedicated service account has only required Secret Manager, Cloud SQL client, GCS, and telemetry permissions.
- Public ingress exposes only the HTTPS API/load balancer; PostgreSQL is never public to browser clients.

### Cloud SQL PostgreSQL

- Prefer private IP/serverless VPC access where constraints allow; otherwise use the Cloud SQL connector with TLS/IAM controls.
- Size Prisma pool, Cloud Run concurrency, and max instances under the database connection budget.
- Enable automated backups/PITR and test restoration.
- Separate local/test/staging/production databases and runtime/migration/read-only roles.

### Google Cloud Storage receipts

1. Browser requests an authorized upload operation from the API.
2. API creates a random server-owned key and short-lived signed operation.
3. Browser uploads directly under explicit GCS CORS; bucket remains private.
4. Browser finalizes; API verifies object size/type/checksum/existence before linking.
5. Reads use authorized short-lived URLs or API streaming and bypass service-worker caches.

### Secret Manager

- Store database, Clerk server/webhook, GCS signing, VAPID private, rate-limit backend, and telemetry secrets.
- Browser bundles contain only public identifiers/endpoints.
- Validate environment shape without logging values and document rotation ownership.

## Notifications and background work

- Store one standards-based Push API subscription per authenticated browser installation with endpoint/key protection, last-seen, and revoked state.
- Domain transactions write outbox events atomically.
- A worker/job claims events, applies preferences, sends via the approved Web Push provider/VAPID implementation, records results, retries transient failures, and disables invalid subscriptions.
- Permission is requested only after informed user interaction; unsupported/denied states use in-app activity indicators.
- Push payloads contain generic text and identifiers/deep links, not sensitive receipt or financial detail.
- Service-worker push handlers show approved notifications and do not mutate financial data.

## Observability and operations

- Pino logs include request ID, safe internal actor ID where justified, route, latency, status, deployment revision, and redaction.
- Metrics cover API/web errors and latency, auth failures, rate limits, DB saturation, idempotency, outbox lag, uploads, push delivery, service-worker versions, and migration health.
- Error tracking/tracing scrubs JWTs, cookies, emails, push endpoints/keys, receipt URLs, and financial notes.
- Runbooks cover Next.js rollback, bad service-worker release, API rollback, migration failure, DB exhaustion, Clerk/GCS/push outage, and secret rotation.

## Testing strategy

- Domain unit/property tests: allocations, rounding, balances, settlements, permissions, and currency invariants.
- Contract/API integration tests: Zod schemas, envelopes, auth, IDOR, pagination, caching, idempotency, and Supertest with isolated PostgreSQL.
- Migration tests: empty DB, production-shaped clone, forward migration, reconciliation, and restore.
- Web tests: components/forms/routes, responsive viewports, keyboard/screen reader, themes, client/API reconciliation, and critical browser E2E.
- PWA tests: manifest/icons, service-worker allowlist/update/rollback, offline fallback, installation, standalone navigation, and no offline financial writes.
- Security tests: XSS output, CSRF/CORS/CSP/cookies, BOLA, replay/rate limits, upload abuse, push lifecycle, webhooks, and log redaction.
- Deployment smoke tests: web health/version, API health/auth, one read, one idempotent write, signed upload, and push subscription in staging.

## Non-negotiable boundaries

- Browser and service-worker bundles never import Prisma/database packages or contain Cloud SQL, Clerk server, GCS privileged, or VAPID private credentials.
- Client-provided IDs never establish authorization.
- No floating-point authoritative money path.
- No offline/background financial mutation queue in MVP.
- No destructive production migration without backup, rehearsal, reconciliation, and explicit approval.
- No deletion of functioning web code until replacement behavior, data reconciliation, rollback, and telemetry are proven.
- No Expo/native MVP implementation; native is a later separately approved option.

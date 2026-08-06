# Spenza Target Architecture

## Architecture outcome

Spenza should become a pnpm workspace containing an Expo mobile client and a separately deployable Express API. The mobile application communicates only with the HTTPS API. Prisma and Cloud SQL credentials exist only in the API runtime. Shared packages may contain types, Zod contracts, pure financial algorithms, and tooling configuration, but never a database client that can enter a mobile bundle.

```text
Expo iOS/Android
  -> Clerk Expo obtains a session token
  -> HTTPS /v1 API with Bearer JWT
  -> Express middleware verifies Clerk JWT and authorizes the internal user
  -> Domain services execute validated commands
  -> Prisma transactions access Cloud SQL PostgreSQL

Mobile -> signed upload request -> Google Cloud Storage
GCS object metadata -> API -> receipt record
API/outbox -> notification worker/Cloud Run job -> Expo Push Service/APNs/FCM
```

## Proposed monorepo

```text
/
├─ apps/
│  ├─ mobile/                 # Expo Router React Native app
│  ├─ api/                    # Express/Cloud Run service
│  └─ web-legacy/             # temporary Next.js reference during migration
├─ packages/
│  ├─ contracts/              # Zod HTTP DTOs, error codes, pagination contracts
│  ├─ domain/                 # pure split, balance, currency, and policy logic
│  ├─ database/               # Prisma schema/client/migrations; API-only exports
│  ├─ config/                 # shared TS/ESLint/Prettier configs, not runtime secrets
│  └─ test-utils/             # factories and deterministic fixtures
├─ infra/                     # Cloud Run/Build/IaC definitions once selected
├─ docs/
├─ pnpm-workspace.yaml
└─ package.json
```

Workspace dependency rules:

- `apps/mobile` may depend on `contracts` and a React-Native-safe subset of `domain`.
- `apps/api` may depend on `contracts`, `domain`, and `database`.
- `database` must not be reachable from the mobile dependency graph.
- `contracts` must not import Express, Prisma, Node-only modules, or provider SDKs.
- Root scripts orchestrate lint, typecheck, test, build, dev, and dependency checks through pnpm filters.

## Mobile application

### Foundation

- Expo managed workflow with TypeScript strict mode and Expo Router.
- NativeWind for theme tokens and layouts; React Native primitives remain the accessibility foundation.
- TanStack Query for server state, caching, invalidation, retry policy, and focus/network integration.
- Zustand only for small client-owned state such as drafts, filters, onboarding, and ephemeral UI; server entities stay in Query cache.
- React Hook Form plus Zod contracts for forms.
- Clerk Expo for authentication and token acquisition.
- Expo SecureStore for Clerk token cache and truly sensitive device-local values; do not store general app state there.
- Reanimated for intentional motion that respects reduced-motion settings.
- Expo Notifications with device-installation registration through the API.
- EAS development, preview, and production profiles; update/runtime version policy documented before OTA updates.

### Routing and screens

- Public: welcome, sign in/up, verification, password recovery/provider callback.
- Onboarding: profile/currency/notification consent.
- Authenticated tabs: dashboard, groups, activity, profile.
- Nested routes: group detail, member/invite management, expense create/detail/edit, settlement flow, receipt preview.
- Deep links: Clerk callbacks, group invitations, expense/activity/notification targets.

### Client/API boundary

- One API client injects bearer tokens, request IDs, app/platform/version headers, timeouts, and typed error decoding.
- Mutations that create financial records send an idempotency key generated once per client intent.
- Query keys are centralized and entity-aware.
- Offline behavior begins as read-cache plus draft preservation. Queued financial writes are introduced only after idempotency and conflict semantics are proven.
- Client calculations are previews. The API returns the authoritative allocation and balances.

## API service

### Runtime and structure

- Node.js LTS explicitly pinned in `engines`, containers, CI, and developer tooling.
- Express with TypeScript strict mode.
- Layered modules: route -> validation/auth middleware -> controller -> domain service -> repository/Prisma.
- Controllers translate HTTP only; domain rules have no Express or Prisma dependency.
- Versioned routes under `/v1`; `/health/live` and `/health/ready` are unversioned operational endpoints.

Suggested middleware order:

1. Trust-proxy policy and request ID.
2. Pino HTTP logging with secret/PII redaction.
3. Helmet security headers.
4. Explicit environment-based CORS allowlist.
5. Body limits and JSON parsing.
6. Global and route-sensitive rate limiting.
7. Clerk JWT verification.
8. Internal user resolution and request context.
9. Zod request validation.
10. Routes/controllers.
11. Typed not-found and centralized error handlers.

### HTTP contract conventions

- JSON DTOs are defined in `packages/contracts` and validated at both boundaries.
- Financial values cross JSON as decimal strings or minor-unit strings, never IEEE-754 numbers.
- ISO 4217 currency codes are explicit on every monetary aggregate.
- Timestamps use ISO 8601 UTC strings; user display time zones are profile/preferences.
- Cursor pagination is used for activity, expenses, groups, and notifications.
- Errors use stable machine codes, request ID, safe message, and optional field errors. Stack traces and provider details never leave the API.
- `Idempotency-Key` is required for create-expense, settlement, and upload-finalization commands.
- Optimistic concurrency/version checks protect editable financial records.

### Initial endpoint surface

| Domain | Representative endpoints |
|---|---|
| Identity | `GET/PATCH /v1/me`, `POST /v1/auth/webhooks/clerk` |
| Friends | `GET /v1/friends`, request/accept/decline endpoints |
| Groups | list/create/get/update/archive, invitations, members, roles, leave/remove |
| Expenses | list/create/get/update/void, allocation preview, receipt attach/detach |
| Balances | group/member summaries and server-authoritative simplified debts |
| Settlements | create, confirm/cancel if product policy requires, history |
| Dashboard | currency-scoped summary, trends, and recent activity |
| Uploads | signed upload intent, finalize, metadata, delete |
| Notifications | list/read/preferences/device-installation registration |

OpenAPI generation is recommended from the same Zod contracts or from a checked contract layer, with compatibility checks in CI.

## Authentication and authorization

### Clerk flow

1. Mobile authenticates with Clerk Expo.
2. Mobile requests a short-lived Clerk session token and sends it as `Authorization: Bearer ...`.
3. API verifies signature, issuer, audience/authorized party as applicable, expiry, and required claims using Clerk's supported backend middleware/JWKS behavior.
4. API maps Clerk `sub` to an internal `User` row using unique `clerkUserId`.
5. Domain authorization uses internal user and resource membership, never client-supplied identity.
6. Clerk webhooks update safe identity/profile fields using signature verification and idempotent event storage.

Clerk authenticates identity; Spenza owns authorization. Group role, membership, invitation, expense, receipt, and settlement policies remain in the database/domain layer.

### User model boundary

- Internal `User.id` remains the stable foreign key for financial history.
- `clerkUserId` is unique and provider-specific.
- Primary email is not the durable foreign key and is never sufficient on its own after linking.
- Better Auth tables remain read-only during transition, then are archived/dropped under an approved retention plan.

## Data architecture

The existing conceptual entities can seed the new schema, but financial and identity foundations need redesign before feature expansion.

### Required principles

- Use PostgreSQL `numeric` through Prisma `Decimal` with a documented precision/scale, serialized as strings, or an approved minor-unit representation. Do not use `Float`.
- Each allocation is deterministic and sums exactly to the expense total under documented currency rounding rules.
- Use explicit payment/allocation records rather than overloading one split row if multiple payers or revisions are required.
- Financial deletion is a void/reversal with audit history; group deletion is archival.
- Store group currency policy and reject incompatible expense/settlement commands unless multi-currency behavior is explicitly designed.
- Add idempotency, record versioning, created/updated actor IDs, and relevant timestamps.
- Add database constraints for positive amounts, percentages, shares, valid pairings, and unique active relationships where Prisma cannot express them alone.
- Add indexes from measured access paths and verify them with representative query plans.

### Recommended model additions/changes

- `User.clerkUserId`, profile status, locale, time zone, default currency.
- `Group`, `GroupMembership`, and `GroupInvitation` with lifecycle states and audit fields.
- `Expense`, `ExpensePayment`, `ExpenseAllocation`, and optional `ExpenseRevision`/void metadata.
- `Settlement` with explicit parties, state transitions, idempotency, and optional confirmation.
- `ReceiptObject` containing bucket/object key and verified metadata rather than a public URL.
- `DeviceInstallation`, `NotificationPreference`, `Notification`, and `NotificationDelivery`.
- `IdempotencyRecord` scoped to actor/operation/key.
- Transactional outbox for push, email, and other side effects.
- Clerk webhook-event deduplication table.

### Migration ownership

- `packages/database/prisma/schema.prisma` is the sole schema source.
- Every production change is an additive-first reviewed Prisma migration, with SQL review where database constraints/indexes require it.
- CI validates schema, generates the client, applies migrations to a fresh PostgreSQL database, and runs integration tests.
- Cloud Run startup does not run development migrations. A controlled release job runs `prisma migrate deploy` before traffic cutover.

## Google Cloud infrastructure

### Cloud Run API

- Multi-stage, non-root container with reproducible pnpm install and health checks.
- Minimum/maximum instances, concurrency, CPU/memory, timeout, and connection-pool size are set together.
- Service account has only Secret Manager access, Cloud SQL client, required GCS permissions, and telemetry permissions.
- Public ingress reaches only the HTTPS API/load balancer; the database is never public to mobile clients.

### Cloud SQL PostgreSQL

- Prefer private IP/serverless VPC access where project constraints allow; otherwise use the Cloud SQL connector with TLS/IAM controls.
- Use a pooled Prisma configuration sized for Cloud Run concurrency and max instances. Cap total possible connections below database limits.
- Enable automated backups and point-in-time recovery; test restoration.
- Separate databases/users for local, test, staging, and production; least-privilege runtime and migration roles.

### Google Cloud Storage receipts

1. Mobile requests an upload intent from the API with declared MIME type and size.
2. API authorizes group/expense access and issues a short-lived signed upload URL/object key.
3. Mobile uploads directly to GCS, not through Cloud Run memory.
4. Mobile finalizes the upload; API verifies object existence, size, content type/checksum, and records metadata.
5. Reads use authorized short-lived signed URLs or an authenticated proxy according to privacy policy.

Use private buckets, uniform bucket-level access, CORS limited to necessary clients, lifecycle rules, object-name randomization, size/type limits, and asynchronous scanning/thumbnailing where required.

### Secret Manager

- Store database URLs/connector configuration, Clerk server secrets/webhook secret, GCS signing material if required, rate-limit backend credentials, and telemetry credentials.
- Mobile contains only publishable/config values appropriate for a public binary.
- Validate environment shape at API startup without logging values.
- Define rotation ownership and dual-key rollout for secrets that support it.

## Notifications and background work

- Device installation records map an internal user to Expo push token, platform, app version, locale, and last-seen/revoked state.
- Domain transactions write outbox events atomically.
- A Cloud Run worker/job or approved task queue claims outbox rows, sends notifications, records provider receipts, retries transient failures, and disables invalid tokens.
- Notification preferences and quiet-hour decisions are enforced server-side.
- Push payloads contain identifiers/deep links, not sensitive expense details on lock screens by default.

## Observability and operations

- Pino structured logs with request ID, authenticated internal user ID where allowed, route, latency, status, deployment revision, and redaction.
- Metrics for request/error latency, auth failures, rate limits, DB pool saturation, idempotency hits, outbox lag, upload failures, push receipts, and migration health.
- Error tracking and traces must scrub JWTs, authorization headers, cookies, emails, receipt URLs, and financial notes.
- Health readiness includes required local initialization and a bounded database check; liveness does not depend on downstream services.
- Runbooks cover rollback, migration failure, Cloud SQL exhaustion, Clerk outage, GCS outage, notification backlog, and secret rotation.

## Testing strategy

- Domain unit tests: deterministic allocation, rounding, balances, settlements, permissions, and currency invariants.
- Contract tests: Zod schemas, error envelopes, pagination, compatibility snapshots/OpenAPI.
- API integration tests: Vitest or Jest plus Supertest against isolated PostgreSQL; Clerk verification mocked at the verification boundary, with separate token-validation tests.
- Migration tests: empty database, sanitized production-shaped snapshot, forward migration, reconciliation queries, and restore rehearsal.
- Mobile tests: component/form tests plus critical Expo end-to-end flows on Android and iOS.
- Security tests: broken object-level authorization, replay/idempotency, rate limiting, upload abuse, webhook signatures, and log redaction.
- Deployment smoke tests: health, auth, one read path, one idempotent write path, signed upload, and notification registration in staging.

## Non-negotiable boundaries

- The mobile bundle never imports Prisma, database packages, Cloud SQL credentials, Clerk server secrets, or GCS privileged credentials.
- Client-provided user IDs never establish authorization.
- No floating-point financial persistence or calculation.
- No destructive production migration without verified backup, rehearsal, reconciliation, and explicit approval.
- No legacy-code deletion until replacement capability, data reconciliation, rollback window, and release telemetry are all proven.


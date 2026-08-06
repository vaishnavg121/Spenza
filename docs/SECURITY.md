# Spenza Security Baseline

## Security model

Spenza stores identity links, group relationships, financial records, receipt images, Web Push subscriptions, and activity history. The principal risks are account takeover, insecure direct object reference (IDOR), unauthorized group access, financial-record tampering, replayed writes/webhooks, cross-site scripting, cross-site request forgery, service-worker/cache leakage, malicious uploads, secret exposure, and excessive sensitive logging.

Security controls are enforced at the API and infrastructure boundaries. Browser route guards, hidden buttons, Next.js middleware, CORS, opaque IDs, service workers, and provider dashboards are defense in depth, not authorization.

## Clerk authentication

- Use Clerk's supported Next.js/browser integration and supported server verification or middleware with a configured JWKS/issuer.
- Verify signature, issuer, expiry, not-before, and configured audience or authorized-party claims. Reject unsupported algorithms and fail closed when configuration is missing.
- Resolve the verified Clerk subject to one internal user. Do not trust a client-supplied user ID, email, role, or membership.
- Cache verification keys only according to provider guidance and handle key rotation. Authentication-provider outages must not result in bypass.
- Do not copy Clerk tokens or session material into `localStorage`, `sessionStorage`, IndexedDB, service-worker caches, TanStack Query persistence, logs, crash reports, or analytics.
- Use secure, HttpOnly, SameSite cookies where the supported Clerk flow provides them. Short-lived bearer tokens sent to the API remain in the supported SDK/runtime boundary and are never persisted by Spenza code.
- Clerk publishable identifiers may be shipped to the browser; secret keys and webhook secrets remain server-side in Secret Manager.

## Authorization and IDOR prevention

- Every protected operation checks object-level permission after authentication and before returning or changing data.
- Queries for group-owned data must include an authorized membership/role constraint or use a policy layer that proves the same condition.
- Check both source and destination objects for cross-resource actions such as moving receipts, accepting invitations, editing participants, and reversing settlements.
- Define role permissions centrally and test deny cases for non-member, former member, invited user, ordinary member, administrator/owner, and unrelated resource IDs.
- Prefer `404` where revealing an object's existence creates unnecessary leakage; otherwise return a documented `403`.
- Never authorize using a role or group ID supplied only by the browser. Never rely on sequential or hard-to-guess IDs for protection.

## Browser, XSS, and CSRF controls

- Use a reviewed Content Security Policy compatible with Next.js and Clerk. Avoid `unsafe-eval` in production and minimize any required `unsafe-inline` allowance with nonces or hashes.
- Render user content as text. Do not render user-controlled rich HTML in MVP. Normalize and bound free text and escape it at the output context.
- Protect cookie-authenticated state-changing requests with the approved SameSite, Origin/Referer validation, and CSRF-token strategy. Never rely on SameSite alone for every browser/topology.
- Bearer-token API calls require explicit environment-specific CORS allowlists. Never reflect arbitrary origins or combine wildcard origins with credentials.
- Set `Secure`, `HttpOnly`, scoped `Path`/`Domain`, and reviewed lifetime attributes on cookies. Clear relevant browser state on sign-out/account switch.
- Use Helmet and Next.js response headers deliberately: HSTS after HTTPS is stable, frame restrictions, MIME sniffing protection, Referrer-Policy, Permissions-Policy, and conservative cache controls for private data.
- Treat browser extensions, shared devices, and XSS as reasons not to persist private API data unnecessarily.

## Input and application controls

- Validate all headers, path/query parameters, bodies, webhook payloads, environment variables, browser storage, push subscriptions, and storage metadata with Zod and explicit size limits.
- Use Prisma parameterization; do not construct raw SQL from untrusted strings. Any required raw query receives focused security review.
- Financial commands additionally enforce `docs/FINANCIAL_INVARIANTS.md`, database transactions, idempotency, and optimistic concurrency.
- Dependency changes require provenance and advisory review, especially for authentication, service workers, uploads, parsing, build tooling, and database access.

## Service-worker and cache security

- Register the production service worker only from the intended HTTPS origin and scope. Do not broaden scope with `Service-Worker-Allowed` without review.
- Cache names include an application/build version and are allowlisted. Activation deletes only known obsolete Spenza caches.
- Never cache authenticated API responses, auth routes/callbacks, tokens, cookies, signed receipt URLs, receipt bodies, mutation responses, push subscription payloads, or user-specific server-rendered HTML.
- Do not implement background sync or replay for expense, settlement, membership, invitation, upload-finalization, or other sensitive writes in MVP.
- An offline fallback contains no user data and cannot imply a financial write succeeded.
- Service-worker updates are tested against interrupted navigation and in-flight mutations. Do not force activation in a way that can corrupt visible state or submit twice.
- Prevent cache poisoning by requiring successful same-origin responses, correct content types, bounded sizes, and explicit request-method/path policies before caching.

## Rate limiting and abuse controls

- Apply rate limits at the API edge/service by normalized client IP and, after authentication, internal actor ID. Do not trust arbitrary forwarding headers outside the configured Cloud Run proxy chain.
- Use stricter limits for authentication-adjacent endpoints, invitation creation/acceptance, search, signed-upload creation, Web Push registration, and write operations.
- Return `429` with a safe retry indication. Rate-limit storage must work across Cloud Run instances; in-memory-only production limits are insufficient.
- Bound page sizes, search complexity, body size, concurrent uploads, object size, and per-user/group storage consumption.
- Record abuse signals without logging secrets or full sensitive payload data.

## CORS and hosting origins

- Use an explicit environment-specific allowlist for the production Next.js origin and approved preview/staging origins. Preview URLs must not be accepted by wildcard.
- Limit allowed methods and headers to the API contract. Cache preflight responses only for a reviewed interval.
- Development origins must not be enabled in production by default.
- Choose same-origin proxying or cross-origin API access explicitly and threat-model cookies, CSRF, CORS, CSP, CDN behavior, and request attribution together.

## Receipt uploads and signed URLs

- Keep Google Cloud Storage buckets private with uniform bucket-level access and public-access prevention.
- The API authorizes each upload, generates a non-user-controlled object key, and issues a short-lived signed operation restricted to that key, method, expected content type, and size where supported.
- Allow only reviewed image formats. Validate declared type, file signature, byte size, dimensions, and checksum; re-encode images or malware-scan according to the approved threat model.
- Finalization verifies that the object exists and matches expected metadata before linking it in a transaction. Unfinalized objects are quarantined or removed by lifecycle policy.
- Receipt reads require current object authorization and short-lived signed URLs or API streaming. Never log or service-worker-cache signed URLs.
- GCS CORS allows only approved web origins/methods/headers and does not make bucket objects public.
- Replacement and deletion preserve financial activity semantics and follow retention/legal requirements. Storage deletion is asynchronous and auditable.

## Web Push and asynchronous work

- Request notification permission only after an informed user gesture. Never block core use on permission or repeatedly prompt after denial.
- Treat Push API endpoints and encryption keys as sensitive identifiers. Do not log them or expose one user's subscription to another.
- Associate subscriptions with the authenticated user and browser installation; revoke or detach on unsubscribe, sign-out, account switch, expiry, or provider rejection.
- Verify Clerk and other webhook signatures against raw request bytes, required timestamp tolerance, and the correct environment secret.
- Store provider event IDs and process webhooks/outbox messages idempotently. Reject replays and duplicate financial or identity effects.
- Authenticate internal jobs and callbacks; do not rely on an obscure URL.
- Retry only idempotent handlers with bounded backoff and a dead-letter/inspection path. Correlate work with request/event IDs.
- Notification payloads shown on lock screens contain minimal information and no receipt URL, token, secret, or unnecessary financial detail.

## Secrets and configuration

- Production secrets live in Google Secret Manager and are injected into Cloud Run or the approved Next.js server runtime using dedicated service accounts/integrations.
- Never commit real `.env` files, service-account keys, database URLs, Clerk secret keys, webhook secrets, GCS signing keys, VAPID private keys, or provider credentials.
- `.env.example` contains names and safe placeholders only. Environment schemas validate presence and shape without printing values.
- Treat all browser-bundled values, including `NEXT_PUBLIC_*`, manifest values, HTML, JavaScript, and service-worker code, as public.
- The web workspace must not contain a database connection string or server credential after API migration. Transitional server-only values remain isolated and are removed slice by slice.
- Rotate a secret immediately if it may have been exposed; preserve evidence, invalidate affected sessions/keys, and document impact without copying the value.
- Separate development, staging, and production projects, credentials, databases, buckets, Clerk instances, push keys, origins, and caches.

## Logging, privacy, and observability

- Use structured Pino logs with request ID, route template, status, latency, internal actor ID where justified, and safe error code.
- Redact authorization/cookie headers, tokens, secrets, database URLs, signed URLs, webhook signatures, push subscriptions, and sensitive request/response fields.
- Avoid logging expense notes, invitation tokens, receipt metadata, email addresses, browser fingerprints, and full provider payloads. Use stable internal IDs when correlation is necessary.
- Access to production logs is least-privileged and audited. Define retention and deletion periods with privacy/legal owners.
- Alerts cover repeated authentication failures, authorization denials, unusual invitation/upload/push volume, webhook failures, elevated financial conflicts, service-worker release regressions, and backup/restore failures without leaking data.

## Google Cloud and hosting least privilege

- Cloud Run uses a dedicated API runtime service account with only required Secret Manager access, database-connect permission, logging, and scoped bucket operations.
- Use the Cloud SQL connector/private networking and TLS. PostgreSQL is not exposed to browsers or the public internet without an approved, restricted administrative path.
- Separate database roles for runtime, migrations, and read-only operations. The runtime role must not own the database or create/drop schema objects.
- Restrict bucket permissions to specific buckets and actions. Do not grant broad project editor, storage admin, or owner roles to application runtimes.
- The Next.js host receives only web-runtime configuration it genuinely needs. It must not inherit database, migration, GCS signing, Clerk secret, or VAPID private-key permissions once the API owns those operations.
- Restrict deployment and secret-version access to CI/CD and named operators; protect production changes with review and audit logs.

## Backups and recovery

- Enable automated Cloud SQL backups and point-in-time recovery with an approved retention window. Protect backups in the required region/project boundary.
- Test restoration to an isolated environment on a schedule and reconcile representative financial invariants after restore.
- Define and approve recovery-point and recovery-time objectives before production launch.
- Document rollback for web, API, service-worker, and database releases. A code rollback must remain compatible with the deployed schema and installed older PWA clients.
- Define receipt lifecycle/versioning protection and recovery expectations separately from database backups.

## Security verification gate

Before a milestone involving protected data is complete, verify:

1. token verification success and failure paths;
2. object-level allow and deny tests, including guessed IDs and former members;
3. Zod rejection and size limits;
4. CORS, CSRF, CSP, cookies, and origin behavior for the deployed topology;
5. rate-limit behavior and trusted-proxy configuration;
6. idempotent retry and concurrent financial-write behavior;
7. service-worker cache allowlist, offline fallback, update behavior, and absence of queued financial writes;
8. log and error redaction;
9. upload authorization, metadata verification, private access, and expiry where applicable;
10. webhook/push signature or subscription lifecycle, replay, and duplicate-event handling where applicable;
11. least-privilege service/database/storage/hosting roles;
12. backup, rollback, and incident-response documentation.

Open security decisions, accepted risks, and exceptions must be recorded in `docs/revamp/RISK_REGISTER.md` or a reviewed successor before release.

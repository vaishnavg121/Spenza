# Spenza Security Baseline

## Security model

Spenza stores identity links, group relationships, financial records, receipt images, device tokens, and activity history. The principal risks are account takeover, insecure direct object reference (IDOR), unauthorized group access, financial-record tampering, replayed writes/webhooks, malicious uploads, secret exposure, and excessive sensitive logging.

Security controls are enforced at the API and infrastructure boundaries. Mobile checks, hidden buttons, CORS, opaque IDs, and provider dashboards are defense in depth, not authorization.

## Clerk authentication

- Use Clerk's supported server verification or middleware and a configured JWKS/issuer. Parsing a JWT without cryptographic verification is prohibited.
- Verify signature, issuer, expiry, not-before, and the configured audience or authorized-party claims. Reject unsupported algorithms and fail closed when configuration is missing.
- Resolve the verified Clerk subject to one internal user. Do not trust a client-supplied user ID, email, role, or membership.
- Cache keys only according to provider guidance and handle key rotation. Authentication-provider outages must not result in bypass.
- Store mobile session material only through Clerk's supported Expo integration backed by Expo SecureStore. Never store tokens in AsyncStorage, query caches, Zustand persistence, logs, crash reports, or analytics.
- Clerk publishable identifiers may be shipped to the app; secret keys and webhook secrets must remain server-side in Secret Manager.

## Authorization and IDOR prevention

- Every protected operation checks object-level permission after authentication and before returning or changing data.
- Queries for group-owned data must include an authorized membership/role constraint or use a policy layer that proves the same condition.
- Check both source and destination objects for cross-resource actions such as moving receipts, accepting invitations, editing participants, and reversing settlements.
- Define role permissions centrally and test deny cases for non-member, former member, invited user, ordinary member, administrator/owner, and unrelated resource IDs.
- Prefer `404` where revealing an object's existence creates unnecessary leakage; otherwise return a documented `403`.
- Never authorize using a role or group ID supplied only by the client. Never rely on sequential or hard-to-guess IDs for protection.

## Input and application controls

- Validate all headers, path/query parameters, bodies, webhook payloads, environment variables, and storage metadata with Zod and explicit size limits.
- Use Prisma parameterization; do not construct raw SQL from untrusted strings. Any required raw query receives focused security review.
- Financial commands additionally enforce `docs/FINANCIAL_INVARIANTS.md`, database transactions, idempotency, and optimistic concurrency.
- Use Helmet with reviewed policy settings, disable unnecessary technology disclosure, enforce HTTPS at the platform, and set conservative response caching for private data.
- Do not render user-controlled rich HTML in MVP. Normalize and bound free text; escape it at the output context.
- Dependency changes require provenance and advisory review, especially for authentication, uploads, parsing, build tooling, and database access.

## Rate limiting and abuse controls

- Apply rate limits at the API edge/service by normalized client IP and, after authentication, internal actor ID. Do not trust arbitrary forwarding headers outside the configured Cloud Run proxy chain.
- Use stricter limits for authentication-adjacent endpoints, invitation creation/acceptance, search, signed-upload creation, notification registration, and write operations.
- Return `429` with a safe retry indication. Rate-limit storage must work across Cloud Run instances; in-memory-only production limits are insufficient.
- Bound page sizes, search complexity, body size, concurrent uploads, object size, and per-user/group storage consumption.
- Record abuse signals without logging secret or full sensitive payload data.

## CORS and clients

- Use an explicit environment-specific allowlist for supported web/admin origins. Do not reflect arbitrary origins and do not combine wildcard origins with credentials.
- Native applications do not rely on browser CORS for security. Authentication and authorization apply identically to every client.
- Limit allowed methods and headers to the API contract. Cache preflight responses only for a reviewed interval.
- Development origins must not be enabled in production by default.

## Receipt uploads and signed URLs

- Keep Google Cloud Storage buckets private with uniform bucket-level access and public-access prevention.
- The API authorizes each upload, generates a non-user-controlled object key, and issues a short-lived signed operation restricted to that key, method, expected content type, and size where supported.
- Allow only reviewed image formats. Validate declared type, file signature, byte size, dimensions, and checksum; re-encode images or malware-scan according to the approved threat model.
- Finalization verifies that the object exists and matches expected metadata before linking it in a transaction. Unfinalized objects are quarantined or removed by lifecycle policy.
- Receipt reads require current object authorization and short-lived signed URLs or API streaming. Never log signed URLs.
- Replacement and deletion preserve financial activity semantics and follow retention/legal requirements. Storage deletion is asynchronous and auditable.

## Webhooks and asynchronous work

- Verify Clerk and other webhook signatures against the raw request bytes, required timestamp tolerance, and the correct environment secret.
- Store provider event IDs and process them idempotently. Reject replays and duplicate financial or identity effects.
- Authenticate internal jobs and callbacks; do not rely on an obscure URL.
- Retry only idempotent handlers with bounded backoff and a dead-letter/inspection path. Correlate work with request/event IDs.
- Notification payloads shown on lock screens contain minimal information and no receipt URL, token, secret, or unnecessary financial detail.

## Secrets and configuration

- Production secrets live in Google Secret Manager and are injected into Cloud Run at runtime using a dedicated service account.
- Never commit real `.env` files, service-account keys, database URLs, Clerk secret keys, webhook secrets, storage signing keys, or push credentials.
- `.env.example` contains names and safe placeholders only. Environment schemas validate presence and shape without printing values.
- Treat all mobile-bundled values, including `EXPO_PUBLIC_*`, as public. The mobile app must not contain a database connection string or server credential.
- Rotate a secret immediately if it may have been exposed; preserve evidence, invalidate affected sessions/keys, and document impact without copying the value.
- Separate development, staging, and production projects, credentials, databases, buckets, Clerk instances, and notification credentials.

## Logging, privacy, and observability

- Use structured Pino logs with request ID, route template, status, latency, internal actor ID where justified, and safe error code.
- Redact authorization/cookie headers, tokens, secrets, database URLs, signed URLs, webhook signatures, device tokens, and sensitive fields from request/response bodies.
- Avoid logging expense notes, invitation tokens, receipt metadata, email addresses, and full provider payloads. Use stable internal IDs when correlation is necessary.
- Access to production logs is least-privileged and audited. Define retention and deletion periods with privacy/legal owners.
- Alerts cover repeated authentication failures, authorization denials, unusual invitation/upload volume, webhook failures, elevated financial conflicts, and backup/restore failures without leaking data.

## Google Cloud least privilege

- Cloud Run uses a dedicated runtime service account with only the required Secret Manager access, database-connect permission, logging, and scoped bucket operations.
- Use the Cloud SQL connector/private networking and TLS. PostgreSQL is not exposed to mobile clients or the public internet without an approved, restricted administrative path.
- Separate database roles for runtime, migrations, and read-only operations. The runtime role must not own the database or create/drop schema objects.
- Restrict bucket permissions to specific buckets and actions. Do not grant broad project editor, storage admin, or owner roles to the application runtime.
- Restrict deployment and secret-version access to CI/CD and named operators; protect production changes with review and audit logs.

## Backups and recovery

- Enable automated Cloud SQL backups and point-in-time recovery with an approved retention window. Protect backups in the required region/project boundary.
- Test restoration to an isolated environment on a schedule and reconcile representative financial invariants after restore.
- Define and approve recovery-point and recovery-time objectives before production launch.
- Document rollback for application releases and forward/restore strategy for migrations. A code rollback must remain compatible with the deployed schema.
- Define receipt lifecycle/versioning protection and recovery expectations separately from database backups.

## Security verification gate

Before a milestone involving protected data is complete, verify:

1. token verification success and failure paths;
2. object-level allow and deny tests, including guessed IDs and former members;
3. Zod rejection and size limits;
4. rate-limit behavior and trusted-proxy configuration;
5. idempotent retry and concurrent financial-write behavior;
6. log and error redaction;
7. upload authorization, metadata verification, private access, and expiry where applicable;
8. webhook signature, timestamp, replay, and duplicate-event handling where applicable;
9. least-privilege service/database/storage roles;
10. backup, rollback, and incident-response documentation.

Open security decisions, accepted risks, and exceptions must be recorded in `docs/revamp/RISK_REGISTER.md` or a reviewed successor before release.

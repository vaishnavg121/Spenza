# Spenza API Conventions

## Scope

These conventions define the public web/PWA-to-API contract. The Express API is the only production path from browser clients to PostgreSQL, Cloud Storage, Web Push delivery, or authoritative financial logic. Next.js rendering code may call the same API server-to-server, but must not bypass it with direct database access after a domain slice is migrated.

## Transport and versioning

- Production traffic uses HTTPS and JSON encoded as UTF-8.
- Public routes begin with `/v1`. Unversioned exceptions are limited to operational endpoints such as `/health/live` and `/health/ready`.
- Paths use lowercase plural nouns and kebab-case for multiword resources. Identifiers are opaque strings.
- Backward-compatible fields and endpoints may be added within `v1`. Removing or reinterpreting a field, changing money semantics, or making an optional field required needs a new version or an explicitly managed compatibility rollout.
- JSON field names use `camelCase`.
- The PWA build version may be sent in an allowlisted header for compatibility telemetry, but it never establishes authorization.

Representative routes:

```text
GET    /v1/me
PATCH  /v1/me
GET    /v1/groups
POST   /v1/groups
GET    /v1/groups/{groupId}
POST   /v1/groups/{groupId}/invitations
POST   /v1/invitations/{invitationId}/accept
GET    /v1/groups/{groupId}/expenses
POST   /v1/groups/{groupId}/expenses
PATCH  /v1/groups/{groupId}/expenses/{expenseId}
POST   /v1/groups/{groupId}/expenses/{expenseId}/void
GET    /v1/groups/{groupId}/balances
POST   /v1/groups/{groupId}/settlements
POST   /v1/groups/{groupId}/settlements/{settlementId}/reversals
POST   /v1/groups/{groupId}/receipts/upload-requests
POST   /v1/groups/{groupId}/receipts/{receiptId}/finalize
POST   /v1/push-subscriptions
DELETE /v1/push-subscriptions/{subscriptionId}
```

State transitions use explicit subresources or action endpoints when a normal resource update would hide important financial or lifecycle semantics. Financial records are voided or reversed, not deleted through `DELETE`.

## Authentication and authorization

- Protected requests use a Clerk-supported browser session flow and send a short-lived `Authorization: Bearer <Clerk JWT>` to the Express API unless an approved same-origin gateway design replaces this transport.
- The API verifies signature, issuer, time claims, and configured audience/authorized-party requirements before resolving the internal user.
- `401 Unauthorized` means authentication is absent or invalid. `403 Forbidden` means the authenticated actor lacks permission. A policy may return `404 Not Found` instead of `403` where hiding resource existence reduces IDOR risk.
- Every protected handler authorizes the actor against the requested object and operation. Route nesting, Next.js middleware, CORS, and a valid session are not object authorization.
- API responses never include Clerk tokens, database credentials, secret configuration, service-worker internals, push private keys, or internal authorization-policy details.
- If cookies are ever accepted directly by the API, the endpoint must also implement the approved CSRF/origin policy documented in `docs/SECURITY.md`.

## Request validation

- Validate headers, path parameters, query parameters, and JSON bodies with Zod before domain execution.
- Reject unknown fields on write requests unless a documented compatibility requirement says otherwise.
- Normalize only explicitly documented values. Do not silently coerce malformed dates, money, IDs, percentages, or booleans.
- Size limits apply to JSON bodies, query strings, list limits, upload metadata, and Web Push subscription payloads.
- Domain validation follows structural validation and returns a stable machine-readable code.

## Success responses

Single-resource response:

```json
{
  "data": {
    "id": "exp_opaque",
    "description": "Dinner",
    "amountMinor": "10000",
    "currency": "INR",
    "version": 1
  }
}
```

List response:

```json
{
  "data": [],
  "page": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

- Use `200` for successful reads/updates/actions with a representation, `201` for creation, `202` only for accepted asynchronous work, and `204` only when no response body is useful.
- Resource creation includes a `Location` header when practical.

## Error responses

All expected errors use this envelope:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The request is invalid.",
    "details": [
      {
        "path": ["splits", 1, "percentageBps"],
        "code": "invalid_total",
        "message": "Percentages must total 10000 basis points."
      }
    ],
    "requestId": "req_opaque"
  }
}
```

- `code` is a stable, documented machine value; `message` is safe for users; `details` is optional and contains no secrets or internals.
- Zod issues are mapped to stable paths and public codes rather than returned raw.
- Unexpected errors return `INTERNAL_ERROR` with status `500`; stack traces, SQL, environment values, and provider payloads remain server-side.
- Common statuses are `400` malformed request, `401` unauthenticated, `403` unauthorized, `404` not found/hidden, `409` version or idempotency conflict, `413` too large, `415` unsupported media, `422` domain-invalid, `429` rate-limited, and `503` temporarily unavailable.
- Connectivity failures are browser/network errors, not successful offline writes. The UI must keep the action explicitly unsaved.

## Identifiers, dates, and money

- IDs are opaque strings. Clients must not infer resource type, authorization, ordering, or creation time from an ID.
- Timestamps use ISO 8601 UTC with a `Z` suffix. Date-only domain values use `YYYY-MM-DD` and must declare their timezone interpretation when converted to a timestamp.
- APIs accept and return canonical timestamps; the web client formats them for the user's locale.
- Monetary values are base-10 integer strings in minor units plus an uppercase ISO 4217 currency, for example `"amountMinor": "10000", "currency": "INR"`.
- API Zod schemas bound money to the approved positive/signed range before conversion to `bigint`. Scientific notation, decimals, commas, and whitespace are invalid.
- Percentages use integer basis points, where `10000` means `100%`. Share weights are positive integers.
- Financial response objects include the stored integer allocations and contributions; clients must not reconstruct them from display percentages.

## Pagination, filtering, and sorting

- Collection endpoints use opaque cursor pagination. Offset pagination is reserved for stable administrative datasets with an explicit reason.
- Default page size is `20`; the general maximum is `100`. Endpoints may define a smaller documented maximum.
- Cursors encode server state and are not constructed by clients. Invalid or expired cursors return a validation error.
- Filters use documented query parameters, such as `memberId`, `category`, `status`, `occurredFrom`, `occurredTo`, and `query`.
- Sorting uses a documented allowlist, for example `sort=-occurredAt`; a leading minus means descending. Every sort includes a deterministic unique tie-breaker.
- Filters and search are always constrained to resources the actor may access.

## Idempotency and concurrency

- `POST` commands that create or change financial state and upload-finalization commands require an `Idempotency-Key` header.
- Scope a key to the authenticated actor, HTTP method, and canonical route. Store a request fingerprint and the original status/body atomically with the command result.
- Repeating the same key and payload returns the original result. Reusing the key with a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.
- Retain keys long enough for supported retry behavior; the initial recommendation is at least 24 hours, pending an operational decision.
- Updates and voids carry the last observed integer `version` or an equivalent `If-Match` precondition. A stale value returns `409 VERSION_CONFLICT` and the client refetches.
- Database uniqueness and transactions enforce guarantees; an in-memory cache alone is insufficient.
- Service workers and Background Sync must not retry or replay financial mutations. Idempotency protects explicit online retries, not an offline queue.

## Request IDs and observability

- Every response includes `X-Request-Id`. Accept a caller-provided value only if it meets length and character rules; otherwise generate one.
- Propagate request IDs to structured logs, database/activity metadata where appropriate, background jobs, and provider calls.
- Never return or log bearer tokens, cookies, secrets, signed URLs, Web Push subscription keys, or full sensitive request bodies.

## HTTP caching and service workers

- Protected and user-specific API responses default to `Cache-Control: private, no-store` unless an endpoint has a reviewed, tested exception.
- Authentication routes, callbacks, mutation responses, signed receipt operations, and notification subscription endpoints are always non-cacheable.
- Public immutable assets may use long-lived cache headers with content hashes. Public metadata may use explicit short revalidation when safe.
- Service workers must use an allowlist and may not override the API's private/no-store semantics.
- The browser's TanStack Query cache is an in-memory performance layer by default and is cleared or isolated appropriately on sign-out/account change.

## Optimistic web updates

- Optimistic state is a user-interface preview, never authoritative financial state.
- The web client submits an idempotency key, retains a rollback snapshot, labels pending work, and replaces the preview with the server representation.
- On validation, authorization, connectivity, or version conflict, roll back the preview, show an actionable error, and invalidate/refetch affected queries.
- Do not enqueue financial writes for later offline submission in MVP. If connectivity is unavailable, retain only an explicitly unsaved draft where approved.
- Notification events and analytics originate from the committed server result, not an optimistic browser action.

## Upload protocol

- The browser requests an authorized upload from the API with expected content type, byte size, and checksum.
- The API creates a server-owned object key and returns a short-lived signed upload operation. The bucket remains private.
- The browser uploads directly to GCS under the bucket's explicit production CORS policy, then finalizes through the API with an idempotency key.
- The API verifies object metadata before associating it with an authorized resource.
- Receipt reads use short-lived authorized URLs or API streaming. Storage object names and signed URLs are not permanent public identifiers and must never enter service-worker caches.

## Web Push subscription protocol

- The browser registers a standards-based Push API subscription only after a user gesture and clear permission education.
- Subscription payloads are validated, tied to the authenticated internal user and a browser installation identifier, and stored as secrets/sensitive identifiers.
- Unsubscribe, sign-out, expiration, provider rejection, and account switching must revoke or detach the subscription safely.
- Push payloads contain minimal identifiers and generic text; the client reauthorizes and refetches after navigation.
- Lack of Push API or denied permission is a supported state, not an application error.

## Contract ownership and testing

- Canonical request/response Zod schemas live in a platform-neutral contracts package once that package is implemented.
- The API maps Prisma/domain values to contracts; it does not expose generated Prisma types as the public interface.
- Contract tests cover success and error envelopes, authorization failures, validation paths, pagination, money serialization, cache headers, idempotent replay, version conflict, upload finalization, and push subscription lifecycle.
- Material contract decisions and compatibility windows are recorded before the PWA depends on them.

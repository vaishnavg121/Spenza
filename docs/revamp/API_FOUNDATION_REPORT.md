# Spenza API Foundation Report

**Date:** August 6, 2026  
**Milestone:** Milestone 4 — API Foundation for Spenza

---

## Outcome

Milestone 4 initialized the production-oriented Express backend application (`apps/api`) and shared Zod boundary contracts package (`packages/contracts`) in the Spenza monorepo.

All infrastructure, middleware, security headers, request ID propagation, rate limiting, CORS controls, typed environment validation, health endpoints, structured Pino logging, and automated integration tests (Vitest + Supertest) were established and verified. No domain logic or Server Actions were migrated from `apps/web`. The existing Next.js web application continues to build and run unchanged.

---

## Packages Created / Installed

### Workspaces Created
1. `packages/contracts` (`@spenza/contracts`): Platform-neutral Zod boundary contracts package.
2. `apps/api` (`@spenza/api`): Production Express backend service.

### Primary Dependencies Added
* **`apps/api`**:
  * `express` (`^4.21.2`): Core HTTP framework.
  * `helmet` (`^8.0.0`): Security HTTP response headers.
  * `cors` (`^2.8.5`): Configurable cross-origin resource sharing.
  * `pino` (`^9.6.0`) & `pino-http` (`^10.4.0`): Structured JSON logging with header/secret redaction.
  * `express-rate-limit` (`^7.5.0`): IP-based rate limiting.
  * `zod` (`4.4.3`): Boundary input and environment validation.
  * `dotenv` (`^16.4.7`): Environment configuration loading.
  * `@spenza/contracts`: Linked workspace dependency for shared DTOs/envelopes.
* **`apps/api` DevDependencies**:
  * `vitest` (`^3.0.5`) & `supertest` (`^7.0.0`): Automated HTTP integration testing.
  * `tsx` (`^4.19.2`): TypeScript dev server runner.
  * `typescript` (`^5`), `@types/express`, `@types/cors`, `@types/supertest`, `@types/node`.
* **`packages/contracts`**:
  * `zod` (`4.4.3`): Runtime contract schemas.

---

## Directory Structure Created

```text
packages/contracts/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
└── src/
    ├── common.ts      # RequestId, ApiErrorEnvelope, ApiSuccessEnvelope, PageMeta, PaginatedResponse
    ├── health.ts      # HealthStatus, HealthResponse
    └── index.ts       # Central package exports

apps/api/
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── .env.example
└── src/
    ├── app.ts         # Express app factory (separated from server port binding)
    ├── server.ts      # Entrypoint with port listener & graceful SIGTERM/SIGINT shutdown
    ├── config/
    │   └── env.ts     # Zod environment schema parser
    ├── lib/
    │   └── logger.ts  # Pino instance with redaction configuration
    ├── errors/
    │   └── app-error.ts # AppError, NotFoundError, ValidationError, UnauthorizedError, etc.
    ├── middleware/
    │   ├── request-id.ts   # X-Request-Id header propagation & generation
    │   ├── cors.ts         # Configurable CORS allowlist middleware
    │   ├── rate-limit.ts   # 300 req / 15 min express-rate-limit policy
    │   ├── not-found.ts    # Standardized 404 handler
    │   └── error-handler.ts # Centralized Zod, AppError & syntax error handling
    ├── routes/
    │   └── health.ts       # GET /health and GET /v1/health endpoints
    ├── types/
    │   └── express.d.ts    # Express req.id ambient type extension
    └── __tests__/
        └── app.test.ts    # Vitest + Supertest suite (7 passing integration tests)
```

---

## Shared Contracts Implemented (`packages/contracts`)

1. **`RequestIdSchema` / `RequestId`**: Opaque string representation.
2. **`ApiErrorEnvelopeSchema` / `ApiErrorEnvelope`**:
   ```json
   {
     "error": {
       "code": "VALIDATION_FAILED",
       "message": "The request is invalid.",
       "details": [{ "path": ["email"], "code": "invalid_string", "message": "Invalid email" }],
       "requestId": "req_12345"
     }
   }
   ```
3. **`ApiSuccessEnvelopeSchema` / `createApiResponseSchema`**: Single resource wrapper `{ "data": ... }`.
4. **`PageMetaSchema` / `createPaginatedResponseSchema`**: Cursor pagination wrapper `{ "data": [...], "page": { "nextCursor": null, "hasMore": false } }`.
5. **`HealthResponseSchema`**: Structured health check output.

---

## Middleware & Security Foundation

The Express request pipeline in `apps/api/src/app.ts` is ordered as follows:
1. **Request ID Propagation:** Extracts incoming `X-Request-Id` or generates `req_<uuid>`, echoing it in response headers.
2. **Pino HTTP Logging:** Structured JSON request logging (ignoring `/health` polling to reduce noise) with automatic redaction of `authorization`, `cookie`, `x-api-key`, `password`, `token`, and `secret`.
3. **Helmet Security Headers:** Sets HSTS, X-Content-Type-Options, X-Frame-Options, CSP, and cross-origin policies.
4. **Explicit CORS:** Configured via `ALLOWED_ORIGINS` (defaults to `http://localhost:3000`), allowing `Content-Type`, `Authorization`, `X-Request-Id`, and `Idempotency-Key` headers.
5. **Body Parsing & Limits:** Limits JSON and URL-encoded bodies to `1mb` to prevent payload inflation.
6. **Rate Limiting:** `express-rate-limit` capped at 300 requests per 15-minute window per IP, returning status `429` with `TOO_MANY_REQUESTS` code.
7. **404 & Error Handling:** Fail-closed exception handling returning structured `ApiErrorEnvelope` responses without stack traces or internal leaks.

---

## Environment Configuration

Managed via `apps/api/src/config/env.ts` with Zod validation:
* `NODE_ENV`: `development` | `test` | `production` (default: `development`)
* `PORT`: Integer port number (default: `4000`)
* `DATABASE_URL`: PostgreSQL connection string
* `ALLOWED_ORIGINS`: Comma-separated CORS origins (default: `http://localhost:3000`)
* `LOG_LEVEL`: Pino log level (default: `info`)

---

## Endpoints Implemented

1. **`GET /health`** (Operational Liveness/Readiness Probe):
   * Status: `200 OK`
   * Response: `{ "status": "ok", "timestamp": "2026-08-06T18:16:02.000Z" }`
2. **`GET /v1/health`** (Versioned Contract Health):
   * Status: `200 OK`
   * Response: `{ "data": { "status": "ok", "timestamp": "...", "version": "0.1.0", "environment": "development", "uptime": 12.34 } }`

---

## Prisma / Database Ownership Strategy

* **Current State:** `apps/web` retains sole ownership of `apps/web/prisma/schema.prisma` and Prisma Client generation. No schema files or migrations were created or modified in `apps/api`.
* **Target State (Milestones 5–12):** Prisma schema will eventually be moved into a dedicated workspace package (`packages/database`), generating a shared client consumed exclusively by `apps/api`. `apps/web` will communicate strictly via HTTP API routes.

---

## Automated Test Results (`apps/api`)

Executed via `pnpm test` (Vitest + Supertest):

```text
✓ src/__tests__/app.test.ts (7 tests)
  ✓ GET /health returns 200 operational liveness probe
  ✓ GET /v1/health returns 200 versioned health contract
  ✓ GET /unknown-route returns 404 with error envelope
  ✓ propagates provided X-Request-Id header
  ✓ generates X-Request-Id header when omitted
  ✓ handles malformed JSON body with 400 MALFORMED_JSON error envelope
  ✓ includes security headers from helmet and CORS headers

Test Files: 1 passed (1)
     Tests: 7 passed (7)
```

---

## Full Verification Results

| Gate / Command | Result | Output Notes |
| :--- | :--- | :--- |
| `pnpm install` | **PASS** | Dependencies linked across 6 workspace projects. |
| `pnpm lint` | **PASS** | Clean run across `@spenza/web` and `@spenza/api`. |
| `pnpm typecheck` | **PASS** | Strict TypeScript passed across all packages. |
| `pnpm test` | **PASS** | 7 passing tests in `@spenza/api`. |
| `pnpm build:web` | **PASS** | Next.js 16.3.0 compiled cleanly (10 static routes). |
| `pnpm build:api` | **PASS** | `tsc` compiled `@spenza/api` to `dist/`. |
| `pnpm prisma:validate` | **PASS** | `apps/web/prisma/schema.prisma` validated successfully. |

---

## Remaining Work Before Milestone 5 (Authentication)

1. Configure Clerk development/staging instances and JWKS endpoint parameters.
2. Implement Clerk JWT verification middleware in `apps/api/src/middleware/auth.ts`.
3. Implement `GET /v1/me` and `PATCH /v1/me` profile endpoints in `apps/api`.
4. Implement Clerk subject-to-internal-user resolution layer.

---

## Confirmation

* **No authentication provider (Clerk) was added.**
* **Better Auth, Prisma schema, migrations, server actions, and financial behavior were unchanged.**
* **Existing Next.js web application continues to build and run without disruption.**
* **No files were committed.**

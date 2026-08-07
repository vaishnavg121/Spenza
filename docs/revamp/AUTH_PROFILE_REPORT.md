# Authentication and Profiles Report

## Outcome

Milestone 5 introduces Clerk as the web authentication provider and API authentication middleware. The API resolves only a verified Clerk subject; it deliberately does not map that subject to the legacy User table because the current schema has no safe persistent Clerk identity field.

## Configuration

Copy apps/web/.env.example and configure Clerk publishable and server secret keys. Configure CLERK_SECRET_KEY in the API environment. Keys are not committed. Enable email/password and Google in the Clerk dashboard as required.

## Web

ClerkProvider, Clerk proxy protection for /dashboard, Clerk sign-in, and UserButton sign-out/profile access replace Better Auth runtime usage. Legacy Better Auth source and database records remain pending Milestone 6 cleanup.

## API and profiles

The public health endpoints stay public. Clerk middleware verifies authentication before protected profile routes. GET /v1/me and PATCH /v1/me are fail-closed with IDENTITY_LINK_REQUIRED until Milestone 6 introduces an explicit Clerk-subject-to-internal-user mapping. PATCH validates strict allowed fields before this response.

## Deferred to Milestone 6

Additive schema migration and backfill/linking policy, safe legacy-user reconciliation, persistent profile reads/writes, and removal of Better Auth records/code after verification.

## Verification

Mocked API tests cover public health, missing and invalid authentication, verified Clerk subject propagation, fail-closed profile reads and writes, malformed profile bodies, and strict profile contracts. No real Clerk keys are required by the test suite.

Completed: pnpm lint, pnpm typecheck, pnpm test (14 tests), pnpm build:api, pnpm build:web, and pnpm prisma:validate.

Manual validation still requires a Clerk development instance with email/password and Google enabled as appropriate, configured web publishable/server keys, and an API server key. Better Auth remains installed with its legacy auth client, server configuration, and API route because database records and the legacy direct-data paths have not yet been migrated; no active web route protection or dashboard session lookup uses it.

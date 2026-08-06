<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Spenza revamp operating rules

These rules apply to every change in this repository.

## Read before changing code

- Read `docs/PRODUCT_SCOPE.md` and `docs/ENGINEERING_RULES.md` for every milestone.
- Read `docs/FINANCIAL_INVARIANTS.md` before touching expenses, splits, balances, settlements, analytics, or money storage.
- Read `docs/API_CONVENTIONS.md` and `docs/SECURITY.md` before changing an API, authentication, authorization, uploads, notifications, or infrastructure.
- Read `docs/MILESTONES.md` and the relevant files under `docs/revamp/` before starting a revamp milestone.
- Inspect the existing implementation and Git status before replacing or moving anything. When changing legacy Next.js code, also follow the generated Next.js rule above.

## Scope and sequencing

- Work on one requested milestone at a time and stop when that milestone is complete.
- Do not begin a later milestone, add adjacent features, or perform unrelated refactors without explicit approval.
- Keep the repository runnable after every major change.
- Preserve the legacy application until its replacement has verified feature and data parity. Delete legacy code only in the approved legacy-removal milestone.
- Prefer small, reviewable, reversible changes. Do not silently combine cleanup with behavior changes.

## Non-negotiable architecture rules

- Mobile clients call the versioned API and never connect directly to PostgreSQL.
- Use strict TypeScript. Do not hide errors with `@ts-ignore`, `@ts-expect-error`, disabled lint rules, or unexplained `any`.
- Validate external inputs and environment configuration with Zod at their boundaries.
- Verify authentication and object-level authorization on the backend for every protected operation.
- Store and calculate money as integer minor units. Never use JavaScript floating point for persisted financial values.
- Make financial writes transactional, idempotent where retries are possible, deterministically rounded, and represented in immutable activity history.
- Keep production secrets in Google Secret Manager or an equivalent approved secret store. Treat every `EXPO_PUBLIC_*` value as public.
- Make database migrations additive by default. Destructive cleanup requires a reviewed plan, verified backup, and rollback path.

## Required verification

- Run the repository's applicable lint, strict type-check, unit/integration test, and production-build commands for every changed workspace.
- Run Prisma formatting/validation when Prisma files or their configuration are touched. Never run a destructive or production migration without explicit approval.
- Add unit tests for every financial calculation and integration tests for protected financial writes.
- Report commands and results, database migrations, security-sensitive changes, unverified behavior, and remaining blockers.
- Never print, commit, or include secret values in reports.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Spenza revamp operating rules

These rules apply to every change in this repository.

## Read before changing code

- Read `docs/PRODUCT_SCOPE.md` and `docs/ENGINEERING_RULES.md` for every milestone.
- Read `docs/PWA_REQUIREMENTS.md` before changing the web manifest, service worker, caching, installation, offline behavior, browser notifications, or responsive shell.
- Read `docs/FINANCIAL_INVARIANTS.md` before touching expenses, splits, balances, settlements, analytics, or money storage.
- Read `docs/API_CONVENTIONS.md` and `docs/SECURITY.md` before changing an API, authentication, authorization, uploads, notifications, or infrastructure.
- Read `docs/MILESTONES.md` and the relevant files under `docs/revamp/` before starting a revamp milestone.
- Inspect the existing implementation and Git status before replacing or moving anything. Follow the generated Next.js rule above for every Next.js change.

## Scope and sequencing

- Work on one requested milestone at a time and stop when that milestone is complete.
- Do not begin a later milestone, add adjacent features, or perform unrelated refactors without explicit approval.
- Keep the production web application runnable after every major change.
- Promote the repaired Next.js application rather than replacing it wholesale. Do not delete functioning code before its replacement is verified.
- Prefer small, reviewable, reversible changes. Do not silently combine cleanup with behavior changes.
- A native Expo application is a possible post-production enhancement, not part of the initial MVP. Do not initialize `apps/mobile` unless a later approved milestone explicitly authorizes it.

## Non-negotiable architecture rules

- Browser and installed-PWA clients call the versioned API and never connect directly to PostgreSQL.
- The target `apps/web` workspace must not import Prisma or database credentials. Temporary legacy server access must be isolated and removed slice by slice as API parity is proven.
- Use strict TypeScript. Do not hide errors with `@ts-ignore`, `@ts-expect-error`, disabled lint rules, unsafe casts, or unexplained `any`.
- Validate external inputs and environment configuration with Zod at their boundaries.
- Verify authentication and object-level authorization in the API for every protected operation.
- Store and calculate money as integer minor units. Never use JavaScript floating point for persisted financial values.
- Make financial writes transactional, idempotent where retries are possible, deterministically rounded, and represented in immutable activity history.
- Financial writes are online-only for the MVP. Service workers, browser storage, and background sync must never queue or replay expense, settlement, or other financial mutations.
- Keep production secrets in Google Secret Manager or an equivalent approved secret store. Treat every `NEXT_PUBLIC_*` value and every browser-delivered value as public.
- Make database migrations additive by default. Destructive cleanup requires a reviewed plan, verified backup, and rollback path.

## PWA safety rules

- Serve production PWA surfaces over HTTPS and keep manifest scope, start URL, icons, and standalone behavior explicit.
- Cache only reviewed public/static assets and the offline fallback. Do not cache authenticated API responses, auth callbacks, signed receipt URLs, private HTML, or mutation responses in the service worker.
- Make offline state explicit and read-only. Disable financial submission without connectivity and never imply that an unsent change was saved.
- Use feature detection for installation, push, badges, and platform capabilities. Browser or OS support must not be assumed from the user agent alone.
- Preserve keyboard access, focus visibility, semantic HTML, screen-reader names, reduced motion, contrast, and minimum touch targets across phone, tablet, and desktop layouts.

## Required verification

- Run the applicable lint, strict type-check, unit/integration tests, and production build for every changed workspace.
- For web/PWA work, also validate the manifest, service-worker registration and scope, cache policy, offline fallback, update behavior, responsive layouts, and supported installation paths.
- Run Prisma formatting/validation when Prisma files or their configuration are touched. Never run a destructive or production migration without explicit approval.
- Add unit tests for every financial calculation and integration tests for protected financial writes.
- Report commands and results, database migrations, security-sensitive changes, unverified behavior, and remaining blockers.
- Never print, commit, or include secret values in reports.

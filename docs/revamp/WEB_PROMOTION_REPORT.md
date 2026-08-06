# Web Application Promotion Report

**Date:** 2026-08-06

## Outcome

Milestone 1 of the revised PWA-first plan is complete. The repaired Next.js application was moved mechanically from `apps/web-legacy` to `apps/web` and renamed from `@spenza/web-legacy` to `@spenza/web`. Root commands, the pnpm lockfile importer, and current repository documentation now target the promoted workspace.

The application source, Prisma schema, authentication implementation, routes, styling, and business logic were not edited. The production build generates the same eight application routes recorded by the repaired baseline. Responsive redesign and PWA functionality were not started.

## Files and directories moved

The complete application directory was moved in place so Git can detect content-identical renames:

| Previous path | Current path | Treatment |
| --- | --- | --- |
| `apps/web-legacy/` | `apps/web/` | Mechanical directory move at the same workspace depth |
| `apps/web-legacy/src/` | `apps/web/src/` | Moved without content changes |
| `apps/web-legacy/public/` | `apps/web/public/` | Moved without content changes |
| `apps/web-legacy/prisma/` | `apps/web/prisma/` | Moved without schema changes |
| `apps/web-legacy/supabase/` | `apps/web/supabase/` | Moved without content changes; retained for later reviewed cleanup |
| Application configuration files | `apps/web/` | Moved; only package identity and workspace README changed |

Ignored local application files, generated output, and dependency links moved with the directory. No environment value was read, displayed, or committed.

## Configuration references updated

- Root `package.json` filters for `postinstall`, `dev:web`, `build:web`, and `prisma:validate` now target `@spenza/web`.
- `apps/web/package.json` is named `@spenza/web`.
- The `pnpm-lock.yaml` workspace importer is `apps/web`.
- Zod `4.4.3`, already present in the frozen lockfile and already imported by application source, is now an explicit web dependency. A clean pnpm install exposed that the prior baseline depended on a transitive/hoisted copy. No dependency version was upgraded.
- Root and web workspace READMEs now document `apps/web`, current root commands, the PWA-first direction, and the correct environment-file location.
- `docs/ENGINEERING_RULES.md`, `TARGET_ARCHITECTURE.md`, `MIGRATION_PLAN.md`, and `REUSE_MATRIX.md` now reflect the completed promotion.
- No CI workflow or deployment configuration exists, so no CI/deployment path required updating.

The directory depth did not change. The following active configurations were inspected and remain correct without content changes:

- `pnpm-workspace.yaml` already includes `apps/*`.
- `apps/web/tsconfig.json` still correctly extends `../../packages/tsconfig/nextjs.json`.
- `apps/web/eslint.config.mjs` still correctly imports `../../packages/eslint-config/next.mjs`.
- `apps/web/next.config.ts` still resolves the absolute Turbopack root with `path.resolve(__dirname, "../..")`, matching the installed Next.js 16 guidance for a workspace root containing the pnpm lockfile and linked packages.
- Prisma scripts remain workspace-local and resolve `apps/web/prisma/schema.prisma`.

## Placeholder directories

- `apps/api/.gitkeep` was retained. Express was not initialized; API Foundation is Milestone 4.
- `apps/mobile/.gitkeep` was retained. The revised milestone documents require a separate reviewed cleanup after confirming no workspace or documentation dependency remains; they do not direct removal in this milestone.
- `packages/contracts/.gitkeep` and `packages/config/.gitkeep` remain unchanged.

## Validation results

| Command/check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed for all four workspace projects; lockfile already up to date |
| `pnpm lint` | Passed; `@spenza/web` ESLint completed without findings |
| `pnpm typecheck` | Passed in strict mode |
| `pnpm test` | Passed as the root orchestrator; no workspace currently defines a test script or automated suite |
| `pnpm prisma:validate` | Passed; `apps/web/prisma/schema.prisma` is valid |
| `pnpm build:web` | Passed with Next.js 16.3.0/Turbopack; compilation, TypeScript, page generation, and optimization completed |
| Route manifest comparison | Same eight application routes as the repaired baseline: `/`, `/_not-found`, `/api/auth/[...all]`, `/dashboard`, `/dashboard/friends`, `/dashboard/groups`, `/dashboard/groups/[id]`, and `/login` |
| Active source/config search for `apps/web-legacy`, `web-legacy`, and `@spenza/web-legacy` | No matches outside documentation |
| Source/schema content comparison | All moved application source, Prisma, public, Supabase, and unchanged config files are content-identical to their pre-move Git blobs |

The first clean-install attempt required pnpm's non-interactive workspace-link refresh, and the sandbox initially denied registry metadata verification. After scoped registry access completed the same frozen installation, the exact required command passed. The clean install then revealed the undeclared Zod dependency described above; declaring the already-locked version restored strict type checking without source changes.

The production build continues to report the known baseline Better Auth diagnostics because `BETTER_AUTH_URL` and `BETTER_AUTH_SECRET` are not configured in the validation environment. Compilation and the production build pass, but authentication callbacks and session security remain environment-dependent and were not functionally exercised.

## Intentional historical references

No active source, package script, workspace configuration, or README references `web-legacy`. Remaining documentation references are intentional:

- `docs/PRODUCT_SCOPE.md` and `docs/revamp/TARGET_ARCHITECTURE.md` record that `apps/web` was promoted from `apps/web-legacy`.
- `docs/MILESTONES.md` preserves Milestone 1's requested source and destination.
- `docs/revamp/MIGRATION_PLAN.md` preserves the completed work item and rollback destination.
- `docs/revamp/REUSE_MATRIX.md` records the workspace's provenance.
- `docs/revamp/PWA_STRATEGY_CHANGE.md` preserves the decision that authorized this implementation milestone.
- `docs/revamp/MONOREPO_SETUP_REPORT.md` remains unchanged historical evidence of the earlier move into `apps/web-legacy` and its validation at that time.

## Remaining work

The exact next milestone is **Milestone 2 — Responsive design foundation**. It will inventory and harden layouts and accessible components across phone, tablet, and desktop widths. This milestone did not change responsive styles, add a manifest or service worker, install PWA dependencies, initialize Express, migrate authentication, alter financial behavior, or modify the database schema.

## Rollback

Revert the directory/package/configuration promotion as one change to restore `apps/web-legacy`. No database, migration, authentication-data, infrastructure, or live-service rollback is required.

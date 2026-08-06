# Monorepo Setup Report

**Date:** 2026-08-06

## Outcome

Milestone 1 converted Spenza from a single root npm package into a pnpm workspace while preserving the existing Next.js application as `@spenza/web-legacy`. The relocated application passes ESLint, strict TypeScript checking, Prisma schema validation, and the Next.js production build. No application feature, business rule, Prisma schema, migration, authentication behavior, or UI was changed.

Mobile Foundation and API Foundation were not started. `apps/mobile` and `apps/api` contain placeholders only.

## Folders and files moved

The following tracked legacy application areas were moved mechanically into `apps/web-legacy` so Git can retain rename history:

| Previous path | New path | Treatment |
| --- | --- | --- |
| `src/` | `apps/web-legacy/src/` | Moved unchanged |
| `public/` | `apps/web-legacy/public/` | Moved unchanged |
| `prisma/` | `apps/web-legacy/prisma/` | Moved unchanged; schema content was not edited |
| `supabase/` | `apps/web-legacy/supabase/` | Moved unchanged with the legacy app |
| `components.json` | `apps/web-legacy/components.json` | Moved unchanged |
| `postcss.config.mjs` | `apps/web-legacy/postcss.config.mjs` | Moved unchanged |
| `README.md` | `apps/web-legacy/README.md` | Retained as the legacy app's original README |
| Next.js, ESLint, TypeScript, and package configuration | `apps/web-legacy/` | Moved, then minimally adjusted for workspace paths/scripts |

The ignored local `.env` and generated `next-env.d.ts` were moved into `apps/web-legacy` without reading or displaying environment values. Generated `.next`, `node_modules`, and TypeScript build caches remain ignored artifacts and are not part of the repository change.

The obsolete `package-lock.json` was removed only after `pnpm-lock.yaml` was generated, the workspace installation succeeded, dependency versions were reviewed, and a frozen install passed. It remains recoverable from Git history.

## New folders

| Path | Milestone 1 contents |
| --- | --- |
| `apps/mobile/` | `.gitkeep` only; Expo was not initialized |
| `apps/api/` | `.gitkeep` only; Express was not initialized |
| `packages/contracts/` | `.gitkeep` only; reserved for later transport contracts |
| `packages/config/` | `.gitkeep` only; reserved for later shared configuration |
| `packages/eslint-config/` | Shared Next.js ESLint flat configuration package |
| `packages/tsconfig/` | Shared strict base and Next.js TypeScript configurations |

## New and changed configuration

- Root `package.json` is private, pins `pnpm@11.16.0`, declares the Next.js-required Node floor of `20.9.0`, and provides `dev:web`, `build:web`, `lint`, `typecheck`, `test`, `build`, and `prisma:validate` orchestration.
- `pnpm-workspace.yaml` includes `apps/*` and `packages/*` and explicitly allows install scripts only for the existing Prisma packages and `unrs-resolver` required by the existing lint stack.
- `pnpm-lock.yaml` is the authoritative workspace lockfile. The legacy `next-themes` dependency was pinned to its previously installed `0.4.4` version to prevent an unrelated semver update during lockfile conversion.
- `packages/tsconfig/base.json` retains strict TypeScript fundamentals. `nextjs.json` contains the existing Next-specific compiler behavior. The legacy app extends that shared configuration and retains its local alias/include paths.
- `packages/eslint-config/next.mjs` contains the existing Core Web Vitals and TypeScript rules plus the Next.js app-root setting. The legacy app's flat config re-exports it.
- The legacy package is named `@spenza/web-legacy` and adds explicit `typecheck`, `prisma:generate`, and `prisma:validate` scripts. The root postinstall regenerates Prisma Client from the relocated unchanged schema.
- `apps/web-legacy/next.config.ts` now sets Turbopack's root to the pnpm workspace root so it can follow pnpm dependency links outside the app directory.
- Root `.gitignore` now applies dependency, build, coverage, generated Prisma, and local pnpm-store exclusions throughout the monorepo.
- Root `README.md` documents the workspace layout, commands, placeholder boundaries, and environment-file location.
- No Prettier configuration was added because the repository has no existing Prettier dependency or formatting baseline; adding one would expand this milestone into an unrelated dependency/formatting change.

## Validation results

### Before relocation

| Command | Result |
| --- | --- |
| `node_modules/.bin/eslint.cmd .` | Passed |
| `node_modules/.bin/tsc.cmd --noEmit` | Passed |
| `node_modules/.bin/prisma.cmd validate` | Passed |
| `node_modules/.bin/next.cmd build` | Passed; 8 routes generated |

### After relocation

| Command | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed for all four workspace projects |
| `pnpm lint` | Passed; ran the legacy ESLint workspace script |
| `pnpm typecheck` | Passed in strict mode |
| `pnpm test` | Passed as an orchestrator; no workspace test script/test suite exists yet |
| `pnpm prisma:validate` | Passed; `apps/web-legacy/prisma/schema.prisma` is valid |
| `pnpm build:web` | Passed; compilation, TypeScript, static generation, and optimization completed with the same 8-route manifest |

The first post-move type-check exposed an ungenerated Prisma Client after pnpm could no longer auto-discover the nested schema during dependency postinstall. A root postinstall hook now runs the legacy package's explicit `prisma generate` command. The first post-move build also confirmed that Turbopack needed the monorepo root to resolve pnpm links; its configured root was updated according to the installed Next.js 16 documentation. Neither fix changes application or schema behavior.

The production build still reports the baseline Better Auth diagnostics for missing `BETTER_AUTH_SECRET` and missing `BETTER_AUTH_URL`/configured base URL. These are environment-dependent warnings already documented in `BASELINE_REPAIR_REPORT.md`; compilation and the production build complete successfully.

## Remaining assumptions and limitations

- Node `>=20.9.0` is the framework minimum documented by the installed Next.js version. The exact Node LTS version for local development, CI, and future Cloud Run deployment still requires an approved version matrix.
- The local ignored `.env` is now expected under `apps/web-legacy`. Other developers and CI must place the legacy environment variables at that application boundary or inject them through their runner.
- No automated tests exist. `pnpm test` is ready to orchestrate package test scripts when later milestones add them, but it currently verifies only that the empty test set is handled successfully.
- Database-backed authentication and product flows were not executed. Validation did not connect to or mutate the configured database.
- Better Auth still needs valid secret and base-URL configuration before authentication runtime behavior can be considered verified.
- Prisma remains owned by the legacy app for Milestone 1. Moving it into a future API-only database package requires a later approved milestone and must not change schema or migration state implicitly.
- `apps/mobile`, `apps/api`, `packages/contracts`, and `packages/config` are reserved boundaries only. They contain no feature implementation or dependencies.

## Rollback

Reverting this milestone restores the former root application layout and `package-lock.json`. The move is filesystem/tooling-only: no database command other than non-destructive validation and client generation was run, no schema or migration was changed, and no live service or data rollback is required.

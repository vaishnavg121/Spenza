# Baseline Repair Report

**Date:** 2026-08-06

## Outcome

The current Next.js baseline now passes ESLint, strict TypeScript checking, Prisma schema validation, and the production build. No Prisma schema or migration was changed.

## Original failures and fixes

| Original failure | Root cause | Fix |
|---|---|---|
| ESLint: unused imports/props and unescaped apostrophes | Stale imports, unused `debtorId`, and JSX text rule violations | Removed unused imports/prop wiring and escaped the two apostrophes |
| ESLint: explicit `any` and unsafe optional non-null assertions on dashboard | Unchecked JSON activity details and rendering values from potentially absent query data | Added a narrow `unknown`-based details parser and safe zero-value balance fallback |
| ESLint: React Hook Form incompatible `watch()` warning | The React compiler lint rule rejects the returned `watch` function | Replaced `watch()` calls with `useWatch()` and declared the effect dependencies |
| TypeScript: Zod resolver/form generic incompatibilities | Zod defaults make schema input and output types differ | Declared React Hook Form input and transformed-output generics explicitly; kept form defaults and validation behavior unchanged |
| TypeScript: `DialogTrigger asChild` errors | Base UI dialog triggers use `render`, unlike Radix `asChild` | Replaced each trigger composition with Base UI's supported `render={<Button />}` API while retaining the same button content and styles |
| TypeScript: unknown `icon-sm` button size | Dialog close control referenced an undeclared variant | Added the existing intended compact icon size variant |
| Server/client boundary issue | A client component imported a Zod schema from a file marked `'use server'` | Moved the unchanged expense schema to `src/lib/expense-schema.ts`; the server action remains server-only |
| Production build: Google Geist fonts could not be fetched | `next/font/google` needs network access during build | Replaced the remote font import with local system font fallbacks and retained the same semantic font tokens |
| Production build: Turbopack chose a lockfile outside the repository | Automatic root detection observed an ancestor lockfile | Set `turbopack.root` to the repository's absolute config-directory path |
| Prisma client singleton environment check typo | `NODE_NODE` was checked instead of `NODE_ENV` | Corrected the environment variable name |

## Files modified

- `next.config.ts`
- `src/actions/expenses.ts`
- `src/app/(auth)/login/page.tsx`
- `src/app/(dashboard)/dashboard/friends/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/expenses/add-expense-dialog.tsx`
- `src/components/friends/add-friend-dialog.tsx`
- `src/components/groups/create-group-dialog.tsx`
- `src/components/groups/group-balances.tsx`
- `src/components/settlements/settle-up-dialog.tsx`
- `src/components/ui/button.tsx`
- `src/lib/db.ts`
- `src/lib/expense-schema.ts`
- `docs/revamp/CURRENT_STATE_AUDIT.md`
- `docs/revamp/BASELINE_REPAIR_REPORT.md`

## Commands and results

| Command | Result |
|---|---|
| `./node_modules/.bin/eslint.cmd .` | Passed with no errors or warnings |
| `./node_modules/.bin/tsc.cmd --noEmit` | Passed |
| `./node_modules/.bin/prisma.cmd validate` | Passed; checked-in schema is valid |
| `./node_modules/.bin/next.cmd build` | Passed; compilation, TypeScript, route generation, and optimization completed |

The direct local binaries were used because the host `npm` wrapper remains misconfigured and cannot locate its global npm CLI. These binaries are the commands invoked by the repository's `lint` and `build` scripts.

## Unresolved environment-dependent issues

The successful production build logged Better Auth runtime configuration diagnostics:

- `BETTER_AUTH_SECRET` is not set; Better Auth reports use of its default secret.
- A Better Auth base URL is not configured. Set `BETTER_AUTH_URL` or configure `baseURL` with an appropriate allowed-host policy.

No secret values were created, changed, or displayed. These diagnostics did not prevent compilation or the successful build, but authentication callbacks, redirects, and session security must not be considered verified until valid environment configuration is supplied.

## Behaviour not verified

- No test suite exists, so automated behavioral regression coverage remains absent.
- Database-backed sign-up, login, authorization, group, expense, friend, settlement, and dashboard flows were not executed; doing so could connect to the configured database.
- Better Auth callback/redirect/session behavior is unverified until the missing base URL and secret are provided.
- Visual equivalence of the former remote Geist font cannot be verified in this offline build environment; the baseline now uses local system fallbacks to guarantee builds without external font access.

## Schema and migration confirmation

`prisma/schema.prisma` was not modified. No Prisma migration directory, migration file, or database command was created or run. The only Prisma command executed was non-destructive schema validation.


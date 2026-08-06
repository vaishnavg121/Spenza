# Spenza Current-State Audit

**Audit date:** 2026-08-06

**Repository:** `https://github.com/vaishnavg121/spenza.git`

**Audited revision:** `main` at `5ed5be6`

**Initial Git state:** clean and aligned with `origin/main`

## Executive assessment

Spenza is currently a small Next.js 16 web prototype, not a mobile application and not a production backend. It contains useful product concepts, a reasonably broad first-pass Prisma model, and prototype flows for email/password authentication, friends, groups, expenses, balances, settlements, dashboard totals, and activity. The implementation is tightly coupled to Next.js Server Actions, Better Auth cookies, DOM-oriented shadcn/Base UI components, and direct server-side Prisma calls.

The repository cannot currently meet its own quality gates: Prisma schema validation passes, but ESLint, strict TypeScript checking, and the production build do not. There are no tests, no migration history, no standalone API, no deployment configuration, and no verified database baseline. The safest reuse is therefore at the product/domain-concept level. The existing UI and server actions should remain available temporarily as behavioral reference while production mobile and API implementations are built alongside them.

No tracked secret file or common credential signature was found in the current tree or Git filename history. A local ignored `.env` exists and defines `DATABASE_URL`; its value was not displayed or tested. This is not proof that the complete Git object database or the configured remote database is free of secrets.

## Repository inventory

| Area | Current contents | Assessment |
|---|---|---|
| Package management | Root `package.json` and `package-lock.json` | Single npm package; no `packageManager`, engines, pnpm lockfile, or workspace |
| Frontend | `src/app`, `src/components`, Tailwind 4, shadcn/Base UI, Next App Router | Entirely web/DOM-oriented; not reusable as React Native views |
| Backend | Five Next.js Server Action files plus one Better Auth route handler | No Express application or general REST API |
| Database | `prisma/schema.prisma`, 14 models, 8 enums | Schema parses, but no Prisma migration directory or seed |
| Authentication | Better Auth with Prisma adapter and email/password | Prototype-only for the target; not Clerk and not suitable for Expo token auth |
| Local services | Generated `supabase/config.toml` | Supabase is not used by application source; config references a missing `supabase/seed.sql` |
| Tests | None | No test script, test runner, test files, fixtures, or coverage configuration |
| Deployment | None | No Dockerfile, Cloud Build, Cloud Run, EAS, CI workflow, IaC, or release configuration |
| Documentation | Default create-next-app `README.md`, agent/tool instructions | README does not describe Spenza, its environment, schema, or operations |
| Assets | Stock Next/Vercel SVGs, one favicon, textual product name | No verified logo system, app icons, splash assets, illustrations, or brand guidelines |
| Generated/local | Ignored `.next`, `node_modules`, `.env`, `src/generated` | `src/generated/prisma` appears stale/inconsistent with the installed Prisma 5 client and is not imported |

## Current stack detected

Versions below are installed from `package-lock.json` unless noted.

| Layer | Detected stack |
|---|---|
| Runtime | Local Node.js 24.19.0; no repository engine policy |
| Web | Next.js 16.3.0, React 19.2.8, React DOM 19.2.8, TypeScript 5.9.3 strict mode |
| Styling/UI | Tailwind CSS 4.3.3, shadcn 4.16.1, Base UI 1.7.0, limited Radix primitives, CVA, Sonner, Lucide React, Recharts |
| Client state/forms | TanStack Query 5.101.4, React Hook Form 7.84.0, Zod 4.4.3 transitively installed, date-fns 4.4.0 |
| Auth | Better Auth 1.6.26 with email/password and Prisma adapter |
| Data | Prisma CLI and Client 5.22.0, PostgreSQL datasource |
| Package manager | npm lockfile; the host npm wrapper is broken; pnpm 11.16.0 is available but the repo has no pnpm lockfile |

## Frontend audit

### Web-only determination

The frontend is definitively web-only:

- Routing, metadata, fonts, redirects, links, and request headers come from `next/*`.
- Views render HTML elements (`div`, `form`, `input`, and related DOM semantics).
- UI primitives depend on Base UI and Radix DOM packages.
- Styling relies on PostCSS/Tailwind web CSS and `globals.css`.
- Charts use Recharts/SVG; icons use `lucide-react`; animations target `framer-motion`.
- Authentication uses Better Auth's React web client and cookie-backed Next.js handlers.
- There is no Expo manifest, Expo Router directory, React Native dependency, EAS configuration, native asset set, or platform project.

No existing view should be copied into the React Native application. Screen information architecture, labels, validation messages, and product flows can be used as reference.

### Implemented screens and flows

- Landing page with links to login/registration.
- Email/password registration and login.
- Auth-gated dashboard shell.
- Dashboard totals, six-month spending chart, and recent activity.
- Friends list, send request, accept, and decline.
- Group creation and group listing.
- Group detail tabs for expenses, balances, and members.
- Expense entry for equal, exact, percentage, and shares splits.
- Suggested group settlements and debtor-recorded cash settlement.

### Incomplete or broken frontend behavior

- `/dashboard/activity` is linked but no page exists.
- No logout, account management, password reset, email verification flow, onboarding, or deep-link handling exists.
- Groups have no add-member, invite, join, leave, role-management, edit, or archive UI.
- Expenses have no edit/delete, receipt, category, date, notes, recurring, offline, or multi-payer flow.
- Settlements are cash-only in the UI and creditors cannot confirm receipt.
- The root layout does not mount the provided Sonner toaster, so toast calls have no verified visible host.
- Currency presentation is hard-coded to `$` even when a group selects another currency.
- `CUSTOM` is accepted by the server schema but has no UI tab or calculation branch.
- The mixed Base UI/Radix composition API produces `asChild` TypeScript errors.
- The default README points to `app/page.tsx`, while the actual file is `src/app/page.tsx`.

## Backend and API audit

There is no reusable Express backend. Business operations are exported as Next.js Server Actions under `src/actions`; mobile clients cannot call these as a stable, documented JSON API. The only route handler is Better Auth's catch-all endpoint at `src/app/api/auth/[...all]/route.ts`.

Server-side code does keep Prisma off the browser, but it does not establish the required mobile/API boundary. The mobile application must call a versioned API over HTTPS, and only that API may access Prisma/Cloud SQL.

### Authorization and integrity defects

| Severity | Finding | Evidence/impact |
|---|---|---|
| Critical | Expense participants and payer are trusted from client input | Caller membership is checked, but `payerId` and split `userId` values are not constrained to group members |
| Critical | Settlement group/payee authorization is incomplete | Any authenticated user can submit an arbitrary group ID and payee ID; outstanding debt and membership are not checked |
| High | `CUSTOM` splits create a zero-owed expense | Schema accepts `CUSTOM`, but calculation has no branch |
| High | Currency invariants are absent | Expense and settlement default to USD instead of inheriting/validating group currency; dashboard aggregates currencies |
| High | Money uses floating-point arithmetic | JavaScript and Prisma `Float` can introduce nondeterministic financial rounding |
| High | No idempotency/concurrency control | Mobile retries can duplicate expense or settlement writes; request races can create inconsistent friendship behavior |
| High | Balance engine is presentation code | Authoritative debt simplification is calculated in a React component and is untested |
| Medium | Declined friendship retry is broken | A declined row falls through to create, then conflicts with the existing unique pair |
| Medium | Symmetric friendship uniqueness is not guaranteed | Unique `(user1Id,user2Id)` does not prevent the reverse pair during concurrent requests |
| Medium | Activity semantics are incorrect | Friend requests are logged as `GROUP_CREATED` |
| Medium | Raw database records are returned | Server Actions generally return Prisma objects rather than explicit DTOs |
| Medium | Dashboard work is in memory | All user splits are loaded and monthly filtering/aggregation occurs in application memory |
| Low | Prisma singleton environment check is misspelled | `NODE_NODE` is used instead of `NODE_ENV` |

## Prisma and database audit

`prisma validate` succeeds for the checked-in schema. The model set is a useful domain sketch: users, friendships, groups/members, expenses/splits, settlements, categories, recurring expenses, notifications, and activities are all represented. It is not production-ready.

### Major schema gaps

- No migration history, baseline migration, seed, or evidence that the checked-in schema matches the existing Cloud SQL database.
- Money fields use `Float`; production amounts need an explicit decimal/minor-unit policy and deterministic allocation rules.
- The app user is also the Better Auth user. There is no separate internal user ID plus unique Clerk subject (`clerkUserId`).
- Better Auth tables store sessions, account tokens, password material, and verification values that cannot simply become Clerk records.
- Group invitations are represented only by a nullable link string; there is no invitation lifecycle, token digest, expiry, inviter, invitee, or status.
- Membership lacks status/history, removal/leave timestamps, and role-change auditing.
- Expense payment is encoded only in split rows; auditability, multiple payers, adjustments, reversals, and immutable revisions are not modeled.
- There is no idempotency key or optimistic/concurrency version on financial commands.
- Receipt storage keeps a raw URL rather than a storage object key, ownership, MIME type, size, checksum, upload state, and deletion state.
- Notifications have no device installation/push token, delivery attempt, preference, or deduplication model.
- Currency strings and category attributes are unconstrained; global category-name uniqueness is unlikely to fit user/system categories.
- Several query indexes required by timelines and unread feeds are absent, such as group/date and user/read-state composites.
- Cascade deletion from group to expenses can erase financial history; production should prefer archival and explicit retention rules.
- There is no explicit privacy/deletion workflow or audit log for privileged changes.

Database connectivity and migration status were deliberately not tested because the sole local environment variable may point to a real Cloud SQL instance. Actual database shape, row counts, extensions, constraints, backups, and data quality remain manual discovery items.

## Authentication audit

Better Auth is locally configured with a Prisma adapter and email/password. Its Next.js route and session checks are internally consistent as a prototype, but only `DATABASE_URL` is present in the local environment-key inventory. Production secrets, trusted origins, mail delivery, and deployment configuration are absent.

The target Clerk Expo/Clerk JWT architecture should replace, not extend, the current auth runtime. Reusable elements are limited to user profile data and authorization intent. Password hashes, sessions, account tokens, and verification records are provider-specific and should not be migrated into Clerk directly. A controlled account-linking plan is required, normally matching verified emails and storing a new Clerk subject on the internal user after conflict review.

## Dependency audit

### Suitable to retain in the target where compatible

- `@tanstack/react-query`
- `react-hook-form`
- `zod` (must become a direct dependency in the appropriate package)
- `@hookform/resolvers`
- `date-fns`
- `clsx`/class composition helpers where NativeWind benefits
- Prisma on the API side only, after an explicit major-version migration

### Web-only or unsuitable for React Native

- `next`, `react-dom`, `next-themes`, `@base-ui/react`, Radix UI packages
- `shadcn`, `recharts`, `sonner`, `lucide-react`, `framer-motion`
- PostCSS web pipeline, `@tailwindcss/postcss`, and `tw-animate-css`

Native replacements include Expo Router, React Native primitives, NativeWind, Reanimated, a native chart strategy selected after profiling, `lucide-react-native` or Expo icons, and a native toast/feedback component.

### Redundant, misplaced, or missing

- `framer-motion` is declared but not imported.
- `supabase` is declared as an application dependency but is not imported; the target infrastructure is Google Cloud.
- `shadcn` is a development CLI but is placed in runtime dependencies.
- Zod is imported throughout source but is only transitively installed.
- Express, Clerk backend verification, Pino, Helmet, CORS, rate limiting, Supertest, a test runner, Google Cloud Storage, and Secret Manager libraries are absent.
- Expo, Expo Router, NativeWind, Zustand, Reanimated, SecureStore, Notifications, Clerk Expo, and EAS tooling are absent.

### Version status checked against the official npm registry

- Prisma CLI/Client 5.22.0 are two major versions behind registry latest 7.9.1. Treat the upgrade as a planned migration, not a blind version bump.
- TypeScript is installed at 5.9.3 while registry latest is 7.0.2; framework compatibility must drive the target version.
- ESLint is installed at 9.39.5 while registry latest is 10.8.0.
- `@types/node` is pinned to the Node 20 line while registry latest is 26.1.2; the project must choose and pin a supported Cloud Run LTS runtime rather than track latest automatically.
- `next-themes` is locked at 0.4.4 while 0.4.6 satisfies the declared range.
- Most other declared packages matched registry latest on the audit date.

## Environment, secrets, and configuration

- `.gitignore` excludes `.env*`, PEM files, build output, dependencies, and generated Prisma output.
- Local `.env` is ignored, untracked, and exposes only the key name `DATABASE_URL` to this audit. Its value was never printed.
- No `.env.example`, runtime environment schema, startup validation, secret rotation guide, or separate local/test/staging/production contract exists.
- No tracked common private-key, cloud-key, GitHub, Slack, Stripe, AWS, or credentialed PostgreSQL URL signature was found in application/config files.
- No suspicious secret filename or `.env` commit was found through Git filename history.
- `supabase/config.toml` uses environment placeholders for sample secrets; no literal configured credentials were found.
- Secret scanning should still be added to CI and the complete Git history should be scanned with a dedicated tool before public release.

## Tests, deployment, documentation, and branding

There is no automated test baseline. Consequently, none of the split, balance, authorization, or migration behavior is protected against regressions. No deployment target is configured for Vercel, Cloud Run, Cloud SQL, GCS, Secret Manager, or EAS.

Branding is limited to the name **Spenza**, the tagline “Split expenses with friends easily,” neutral black/white design tokens, a favicon, and stock Next/Vercel SVGs. The stock assets are not useful for the mobile product. The name, tagline, terminology, and some screen hierarchy can seed a design brief, but app icon, splash, typography, color, illustration, accessibility, and store asset work must be supplied or designed.

## Validation results

| Command/check | Result |
|---|---|
| `git status --short --branch` | Passed; `main...origin/main`, clean at audit start |
| `git remote -v` | Confirmed the supplied GitHub repository |
| Repository/file inventory with `rg --files` and PowerShell | Completed |
| `npm ls --depth=0` | Could not run because the host npm wrapper points to a missing global npm CLI |
| `prisma validate` via local binary | Passed; schema parses successfully |
| `eslint .` via local binary | Failed: 7 errors and 4 warnings |
| `tsc --noEmit` via local binary | Failed: form resolver types, dialog trigger composition, and button variant types |
| `next build` via local binary | Failed while fetching Geist/Geist Mono from Google Fonts; independent type checking also fails |
| Test inventory | No `test` script and no test/spec files |
| `pnpm outdated --format json` | Could not run because the repository has no pnpm lockfile |
| Official npm registry version query | Completed for all declared direct dependencies |
| `prisma --version` | Confirmed Prisma CLI/Client 5.22.0 |
| Tracked/current secret-signature scan | No common secret signatures found |
| Git secret-filename/history checks | No suspicious paths and no `.env` commit found |

## Information that must be supplied manually

1. Google Cloud project IDs, regions, Cloud SQL instance/database names, connection method, private networking policy, and approved service accounts.
2. A read-only database inventory or sanitized dump, plus backup/PITR status and permission to baseline the actual production schema.
3. Whether existing records are production data, test data, or disposable; expected user and transaction counts.
4. Clerk instance details, enabled login methods, verified-email policy, organization usage decision, and account-linking rules.
5. Current Better Auth user count and whether password users need an invitation/password-reset transition.
6. Supported currencies, rounding rules, maximum amounts, locale/time-zone policy, settlement semantics, and legal/accounting retention requirements.
7. Product decisions for group invitations, non-registered participants, expense editing/deletion, recurring expenses, multiple payers, offline behavior, and settlement confirmation.
8. GCS bucket naming/region, retention, lifecycle, signed-upload policy, image limits, malware/content scanning expectations, and privacy deletion policy.
9. Notification events, preference model, quiet hours, Android/iOS credentials, and whether transactional email is also required.
10. Brand assets and guidelines: logo, app icon, splash, colors, typography licenses, tone, screenshots, and store-listing content.
11. Apple Developer, App Store Connect, Google Play Console, Expo/EAS, domain/DNS, and CI/CD ownership.
12. Availability, latency, recovery, observability, compliance, analytics, and budget targets.

# PWA Strategy Change

**Decision date:** 2026-08-06

## Decision

Spenza's initial product strategy changes from an Expo-native Android/iOS client to a responsive, installable Progressive Web App based on the repaired Next.js application.

The Express/Prisma/PostgreSQL/Clerk/Google Cloud backend direction remains. The browser never connects directly to PostgreSQL. A native Expo application may be evaluated only after the PWA reaches production maturity and has evidence that native investment is justified.

## Why the direction changed

- The repository already contains a functioning Next.js App Router product prototype with authentication, groups, expenses, balances, settlements, dashboard, forms, and an accessible web component foundation.
- The repaired Next.js baseline passes lint, strict TypeScript, Prisma validation, and production build checks.
- A PWA can serve phone, tablet, and desktop users from one deployable client while retaining installation paths on Chromium/Android and Home Screen behavior on supported iOS/iPadOS versions.
- Promoting the existing app reduces rewrite surface and preserves working behavior, Git history, and a direct rollback path.
- The unsafe parts identified by the audit are primarily financial integrity, authorization, schema, auth-provider, and backend-boundary problems. Rewriting the visual client in React Native would not solve those risks.

## Repository consequences

- In the next implementation milestone, mechanically rename `apps/web-legacy` to `apps/web` and update workspace paths/scripts without changing product behavior.
- Treat the renamed application as the production web foundation, not an archive scheduled for wholesale deletion.
- Retain and harden safe routes, layouts, accessible UI primitives, responsive-capable components, forms, copy, and product flows.
- Move unsafe Server Actions and direct Prisma paths behind the versioned Express API one domain slice at a time.
- Preserve the working build at every phase. Do not delete functioning code before replacement parity and rollback evidence exist.
- Keep `apps/mobile/.gitkeep` temporarily. Do not initialize Expo. Plan removal in a separate cleanup commit after the PWA-first direction and workspace references are confirmed.
- Keep `apps/api` as a placeholder until the API Foundation milestone; do not initialize Express as part of this documentation change.

## Superseded planning assumptions

The following earlier assumptions are superseded:

- Expo Router/NativeWind/EAS is no longer the MVP client stack.
- Android/iOS native release builds are no longer MVP acceptance gates.
- The existing Next.js UI is not merely a behavioral reference to be discarded.
- Better Auth remains temporary, but its replacement is Clerk for the web/API rather than Clerk Expo.
- Expo push tokens and mobile device installations are replaced in MVP planning by standards-based browser Push API subscriptions and capability-specific fallback.
- Native secure storage, app-store signing, deep links, and native navigation are deferred.

Historical audit, baseline-repair, and monorepo reports remain unchanged as evidence of what was observed and completed at the time. Where they describe the former target, this decision and the revised normative documents take precedence.

## Decisions retained unchanged

- Integer minor-unit money and all rules in `docs/FINANCIAL_INVARIANTS.md`.
- Versioned Express API with Zod contracts, Clerk JWT verification, Pino, Helmet, CORS, rate limiting, Vitest, and Supertest.
- Prisma/PostgreSQL with additive migrations and verified reconciliation.
- Cloud Run, Cloud SQL, private GCS receipts, and Secret Manager.
- Object-level authorization, idempotency, optimistic concurrency, immutable activity, and no direct client database access.
- Online-only financial writes for the MVP.

## PWA-specific guardrails

- Installation is progressive enhancement; the ordinary responsive browser experience remains complete.
- Service workers cache only reviewed public/static assets and an offline fallback.
- Authenticated API responses, private HTML, receipts, signed URLs, auth routes, and mutations are not service-worker cached.
- Financial writes are never queued or replayed in the background.
- PWA updates must not force reloads during active financial writes.
- Browser installation, push, badges, file APIs, and background behavior use feature detection and graceful fallback.

## Migration approach

Use an in-place strangler migration:

1. Promote and rename the repaired web workspace mechanically.
2. Establish responsive and accessible foundations without feature redesign.
3. Add the manifest, safe service worker, installation, offline fallback, and update handling.
4. Build the Express API and migrate domain slices from Server Actions/direct Prisma access.
5. Migrate Better Auth identities to Clerk additively.
6. Replace unsafe financial/schema behavior behind tested contracts while keeping the web application runnable.
7. Release the PWA only after browser, accessibility, security, data, deployment, and rollback gates pass.

## Rollback

Documentation can be reverted without code or data impact. Future implementation phases must remain independently reversible: the workspace rename is mechanical, responsive/PWA additions are additive, API slices are feature-flagged or compatibility-routed, and database changes follow expand-and-contract rules.

## Open confirmations

- Supported browser/OS matrix and deprecation window.
- Next.js hosting platform, domain, CDN, and same-origin versus cross-origin API topology.
- Final PWA colors, icon/maskable icon set, screenshots, and installation copy.
- Clerk web sign-in methods, session/token topology, and Better Auth account-linking policy.
- Web Push/VAPID provider and key ownership, payload policy, and fallback notification channels.
- Whether local unsaved drafts are allowed, their retention/privacy policy, and which non-financial reads may be available from cache.
- Accessibility conformance target and manual test ownership.

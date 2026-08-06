# Spenza Product Scope

## Product intent

Spenza is a responsive, mobile-first expense-sharing Progressive Web App. It helps trusted groups record shared spending, calculate each member's position deterministically, and settle debts with an auditable history.

The initial production client is the existing Next.js App Router application, promoted from `apps/web-legacy` to `apps/web` and progressively hardened. It must work in mobile, tablet, and desktop browsers; installed Chrome and Edge desktop windows; installed Android PWAs; and iPhone/iPad Home Screen web applications where the platform supports the required capability.

The browser never connects directly to PostgreSQL. The production web application communicates with a versioned Express API, which owns authorization, financial calculations, transactions, and persistence. A native Expo client may be evaluated only after the PWA has reached production maturity; it is not part of the initial MVP.

## Primary users and jobs

- Friends, households, travel parties, and small teams that share expenses.
- A member can create or join a group, record who paid and who benefited, understand who owes whom, and record a settlement.
- A member can review activity, find prior expenses, attach receipt evidence, and receive relevant notifications where the browser and user permission allow.
- A member can use the same responsive application from a phone, tablet, desktop browser, or installed PWA without losing access to core online workflows.

## MVP scope

| Capability | MVP outcome |
| --- | --- |
| Authentication | Sign up, sign in, sign out, session restoration, and protected routes through Clerk for the web and API. |
| Profiles | Display name and a selection from approved built-in avatars. |
| Groups | Create, view, update, and leave groups subject to membership and ownership rules. Each group has one configured currency. |
| Memberships | Roles, membership lifecycle, and authorization enforced by the API. |
| Invitations | Create, accept, reject, expire, and revoke group invitations without exposing membership data to unauthorized users. |
| Expenses | Create, view, edit, and void shared expenses with a description, date, category, participants, and optional receipt. |
| Split methods | Equal, exact amount, percentage, and shares, all rounded deterministically in integer minor units. |
| Payers | One or multiple payers whose contributions total the expense amount. |
| Balances | Per-member and group balances derived from valid expenses and settlements, with an explicit direction convention. |
| Settlements | Record and reverse repayments without rewriting financial history. |
| Activity | Immutable, chronological records for financial changes and important membership events. |
| Dashboard | Responsive overview of groups, balances, recent activity, and unsettled positions. |
| Search and filters | Search and filter accessible expenses and activity by supported fields such as group, member, date, category, and status. |
| Receipts | Upload, view, replace, and remove private receipt images through API-authorized signed storage operations. |
| Analytics | Basic descriptive totals and category/member summaries within a single currency context. |
| PWA installation | Valid manifest, icons, standalone display, safe service worker, update handling, and documented installation guidance for supported browsers. |
| Browser notifications | Preference-aware Web Push where supported, with graceful fallback when unavailable or denied. |
| Appearance | Accessible light, dark, and OLED-dark themes across responsive breakpoints. |

## Supported MVP surfaces

- Current supported releases of Chrome, Edge, Firefox, and Safari on desktop.
- Current supported mobile browsers on Android and iOS/iPadOS.
- Installed PWA windows in Chrome and Edge on supported desktop operating systems.
- Installed Android PWAs in supporting browsers.
- iPhone and iPad Home Screen web applications where supported.

The exact minimum browser/OS matrix and support window require release-owner approval before Milestone 13. Unsupported or missing capabilities must degrade to the normal responsive web experience rather than block core online workflows.

## Explicitly later

The following are not part of MVP and require separate product, privacy, security, and delivery approval:

- a native Expo/React Native application and app-store distribution;
- receipt OCR;
- AI categorization, summaries, or insights;
- budget prediction;
- currency conversion or exchange-rate accounting;
- recurring expenses;
- offline financial-write queues, background sync, or conflict resolution;
- comments and reactions;
- PDF or spreadsheet exports;
- QR-code invitations;
- advanced animation beyond purposeful interaction feedback;
- themes beyond light, dark, and OLED dark.

## Product boundaries

- Spenza records obligations and settlements; it does not move money or integrate a payment processor in MVP.
- A group has one accounting currency. Cross-currency conversion is not performed. Analytics and balances must never silently aggregate unlike currencies.
- Receipt images are evidence, not the source of financial values in MVP.
- Expense deletion is a reversible void operation in the financial ledger, not an untracked hard delete.
- Settlement correction uses a linked reversal and, when needed, a replacement settlement.
- The API is authoritative for membership, authorization, financial calculations, balances, and activity. Browser calculations are previews only.
- Financial writes require a live network connection. An offline or failed write remains explicitly unsaved and is never queued by the service worker.
- Installation and push are enhancements. A user who keeps Spenza in a normal browser tab must retain all core online product capability.
- Browser push availability, installation UI, badges, and background behavior differ by browser and OS; the product must use feature detection and clear fallback states.

## MVP acceptance outcomes

The MVP is complete only when:

1. A new user can authenticate, select a built-in avatar, create or join a group, and see only authorized data in the responsive web application.
2. Every supported split and multi-payer case produces deterministic, tested allocations whose integer minor units exactly reconcile.
3. Expense edits, voids, settlements, and reversals update balances transactionally and leave an immutable activity trail.
4. Core journeys pass the approved mobile, tablet, and desktop browser matrix with keyboard, screen-reader, touch, responsive, and performance checks.
5. The PWA is installable on approved Chromium and Android targets, has a documented iOS/iPadOS Home Screen path, handles updates safely, and provides a non-misleading offline fallback.
6. The API is deployed to Cloud Run, uses Cloud SQL and private Cloud Storage correctly, and obtains production secrets from Secret Manager.
7. The production Next.js hosting decision, HTTPS, domain, caching/CDN behavior, monitoring, rollback, and release ownership are documented and exercised.
8. Working web behavior remains available throughout migration; no functioning path is deleted before replacement verification and data reconciliation.

## Product decisions still requiring confirmation

- Initial launch countries, supported group currencies, and the authoritative ISO 4217 currency metadata source.
- Minimum browser/OS versions, accessibility target, responsive breakpoint evidence, and the duration of support for older installed PWA versions.
- Next.js hosting platform, public domains, same-origin versus cross-origin API topology, and CDN/cache ownership.
- Whether email, phone, social providers, or a subset are enabled in Clerk, and how existing Better Auth identities are linked.
- Invitation channels, expiry duration, role defaults, and behavior for people who have not registered.
- Group-owner transfer, last-owner departure, member removal, and access to historical expenses after leaving.
- Which expense fields remain editable, the correction window if any, and who may void or reverse financial records.
- Receipt file types, maximum size, retention, malware-scanning requirement, and deletion policy.
- Exact dashboard and analytics metrics, search scope, notification defaults, and user retention expectations.
- Web Push provider/VAPID ownership, notification events, privacy-safe payloads, and fallback communication when push is unavailable.
- Approved app name presentation, short name, icon/maskable icon set, theme color, background color, screenshots, and installation copy.
- Availability targets, data residency, backup retention, recovery-point objective, and recovery-time objective.

## Source of truth

This document controls product scope. `docs/PWA_REQUIREMENTS.md` controls PWA behavior, `docs/FINANCIAL_INVARIANTS.md` controls money behavior, `docs/API_CONVENTIONS.md` controls the wire contract, `docs/SECURITY.md` controls security requirements, and `docs/MILESTONES.md` controls delivery sequencing. Existing audit and completed-work reports under `docs/revamp/` remain historical evidence; the strategy change is recorded in `docs/revamp/PWA_STRATEGY_CHANGE.md`.

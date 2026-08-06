# Spenza Product Scope

## Product intent

Spenza is a mobile-first expense-sharing application for Android and iOS. It helps trusted groups record shared spending, calculate each member's position deterministically, and settle debts with an auditable history.

The production client is an Expo React Native application backed by a versioned API. The mobile application never connects directly to PostgreSQL. The existing Next.js application remains a temporary reference and fallback until replacement capabilities and data migration are verified.

## Primary users and jobs

- Friends, households, travel parties, and small teams that share expenses.
- A member can create or join a group, record who paid and who benefited, understand who owes whom, and record a settlement.
- A member can review activity, find prior expenses, attach receipt evidence, and receive relevant notifications.

## MVP scope

| Capability | MVP outcome |
| --- | --- |
| Authentication | Sign up, sign in, sign out, session restoration, and protected navigation through Clerk. |
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
| Dashboard | Actionable overview of groups, balances, recent activity, and unsettled positions. |
| Search and filters | Search and filter accessible expenses and activity by supported fields such as group, member, date, category, and status. |
| Receipts | Upload, view, replace, and remove private receipt images through API-authorized signed storage operations. |
| Analytics | Basic descriptive totals and category/member summaries within a single currency context. |
| Push notifications | Device registration, preferences, and notifications for selected group, expense, invitation, and settlement events. |
| Appearance | Accessible light, dark, and OLED-dark themes. |

## Explicitly later

The following are not part of MVP and require separate product, privacy, security, and delivery approval:

- receipt OCR;
- AI categorization, summaries, or insights;
- budget prediction;
- currency conversion or exchange-rate accounting;
- recurring expenses;
- offline financial-write queues or conflict resolution;
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
- The server is authoritative for membership, authorization, financial calculations, balances, and activity. Client calculations are previews only.
- The MVP does not promise fully functional financial writes while offline.

## MVP acceptance outcomes

The MVP is complete only when:

1. A new user can authenticate, select a built-in avatar, create or join a group, and see only authorized data.
2. Every supported split and multi-payer case produces deterministic, tested allocations whose integer minor units exactly reconcile.
3. Expense edits, voids, settlements, and reversals update balances transactionally and leave an immutable activity trail.
4. Android and iOS release candidates pass the agreed functional, accessibility, security, and performance checks.
5. The API is deployed to Cloud Run, uses Cloud SQL and private Cloud Storage correctly, and obtains production secrets from Secret Manager.
6. Operational logs, health checks, backups, rollback procedures, and incident ownership are documented and exercised at the agreed level.
7. Legacy code remains available until feature parity and migrated-data reconciliation are signed off.

## Product decisions still requiring confirmation

- Initial launch countries, supported group currencies, and the authoritative ISO 4217 currency metadata source.
- Whether email, phone, social providers, or a subset are enabled in Clerk, and how existing Better Auth identities are linked.
- Invitation channels, expiry duration, role defaults, and behavior for people who have not registered.
- Group-owner transfer, last-owner departure, member removal, and access to historical expenses after leaving.
- Which expense fields remain editable, the correction window if any, and who may void or reverse financial records.
- Receipt file types, maximum size, retention, malware-scanning requirement, and deletion policy.
- Exact dashboard and analytics metrics, search scope, notification defaults, and user retention expectations.
- Availability targets, data residency, backup retention, recovery-point objective, and recovery-time objective.

## Source of truth

This document controls product scope. `docs/FINANCIAL_INVARIANTS.md` controls money behavior, `docs/API_CONVENTIONS.md` controls the wire contract, `docs/SECURITY.md` controls security requirements, and `docs/MILESTONES.md` controls delivery sequencing. Existing files under `docs/revamp/` provide repository-specific context and migration rationale.

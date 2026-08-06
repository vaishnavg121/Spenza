# Spenza Reuse Matrix

## Classification rules

- **Retain unchanged** — safe artifact, validated fact, or invariant that can remain as-is.
- **Retain with modifications** — useful foundation requiring targeted hardening, decoupling, accessibility, responsive, or security work.
- **Rewrite** — behavior is useful but implementation is unsafe, incorrect, or coupled to the wrong boundary.
- **Archive temporarily** — keep runnable/readable through migration and retention windows, then remove from the active path.
- **Delete after migration** — remove only after replacement, reconciliation, rollback, and retention gates pass.

The matrix describes final treatment. It does not authorize deletion or implementation outside the requested milestone.

| Area / important part | Classification | PWA-first rationale and required action |
| --- | --- | --- |
| Git history and repository identity | Retain unchanged | Preserve provenance and tag migration checkpoints. |
| Product name “Spenza” and expense-sharing concept | Retain unchanged | Only established brand/product identity; confirm trademark and final visual system separately. |
| Financial rules in `docs/FINANCIAL_INVARIANTS.md` | Retain unchanged | Client strategy does not change integer money, rounding, balance, settlement, idempotency, or audit rules. |
| Existing internal `User.id` foreign-key identity | Retain unchanged | Keep stable for ownership/history; add Clerk subject rather than replace IDs. |
| pnpm workspace and root validation orchestration | Retain unchanged | Milestone 1 restructuring is a valid foundation for web/API work. |
| `apps/web-legacy` directory name | Retain with modifications | Mechanically rename to `apps/web` next; preserve Git history and behavior. |
| Entire repaired Next.js application | Retain with modifications | It becomes the production web/PWA foundation, not a disposable legacy reference. |
| Next.js App Router/React/React DOM | Retain with modifications | Keep and harden using installed Next.js guidance, clear server/client boundaries, API extraction, and PWA metadata. |
| TypeScript strict-mode intent/shared configs | Retain with modifications | Preserve strictness; add web, API, contracts, worker, and test variants without suppressions. |
| Tailwind CSS/global semantic tokens | Retain with modifications | Keep web styling; extract accessible semantic tokens and responsive/light/dark/OLED foundations. |
| Existing route hierarchy and layouts | Retain with modifications | Preserve working flows; make responsive, accessible, and API-backed slice by slice. |
| Existing user-facing copy/product flows | Retain with modifications | Use as behavior baseline; correct misleading currency, activity, auth, and unsupported-feature text. |
| `src/components/ui` shadcn/Base UI/Radix system | Retain with modifications | Web-native primitives are now strategically useful; retain accessible/suitable parts, resolve composition consistency, test keyboard/focus/touch behavior. |
| Feature components under `src/components` | Retain with modifications | Reuse DOM implementations where safe; decouple direct data assumptions and add responsive/accessibility states. |
| Existing favicon | Archive temporarily | Keep until an approved PWA icon/favicon/maskable set replaces it. |
| Stock Next/Vercel SVG assets | Delete after migration | Not Spenza branding; remove only after production asset references are verified. |
| TanStack Query | Retain with modifications | Keep for browser server state with centralized query keys, auth/account cleanup, and no persisted financial mutation queue. |
| React Hook Form and resolver approach | Retain with modifications | Keep for accessible web forms and correct Zod input/output typing. |
| Zod validation approach | Retain with modifications | Make canonical/direct where needed; share transport-safe contracts and validate environment/browser boundaries. |
| `date-fns` | Retain with modifications | Keep only with explicit UTC/user-time-zone/date semantics. |
| `clsx`, CVA, and Tailwind class helpers | Retain with modifications | Useful for web component variants; keep responsibilities clear and avoid redundant merging libraries. |
| Lucide React | Retain with modifications | Web-compatible; retain with accessible labels/hidden decorative treatment and bundle review. |
| Sonner/toast feedback | Retain with modifications | Web-compatible; mount/test one accessible host and do not rely on toast as the only error/state signal. |
| Recharts/dashboard chart approach | Retain with modifications | May remain for responsive descriptive charts if performance and accessible data alternatives pass. |
| Framer Motion | Delete after migration | Currently unused; remove in focused cleanup unless a reviewed reduced-motion use justifies it. |
| `next-themes` | Retain with modifications | Suitable for web themes; verify hydration, CSP, system/light/dark/OLED semantics, and standalone mode. |
| Existing profile/group/expense/dashboard concepts | Retain with modifications | Product vocabulary and flows remain, but authorization, financial integrity, and data access must move to the API. |
| Prisma conceptual entities/enums | Retain with modifications | Users, groups, expenses, splits, settlements, notifications, and activity remain useful domain vocabulary. |
| Checked-in Prisma schema as production design | Rewrite | Replace Float money/auth coupling/invite/receipt/push/audit/idempotency gaps additively after actual-database discovery. |
| Existing database records | Retain with modifications | Preserve, profile, backfill, and reconcile; never discard to simplify migration. |
| Existing group/member role intent | Retain with modifications | Add lifecycle, invitations, audits, owner rules, authorization, and indexes. |
| EQUAL/EXACT/PERCENTAGE/SHARES product semantics | Retain with modifications | Preserve after deterministic integer implementation and explicit stable-order rules. |
| `CUSTOM` split enum | Archive temporarily | Hide until semantics are approved; remove later if product rejects it. |
| Currency list/per-group currency idea | Retain with modifications | Replace free strings/hard-coded symbols with approved ISO policy and currency-scoped invariants. |
| Dashboard/activity concepts | Retain with modifications | Preserve useful metrics/timeline after contracts, typed events, authorization, and DB aggregation. |
| Expense calculation Server Action | Rewrite | Float arithmetic, trusted participant IDs, broken CUSTOM branch, and direct Prisma coupling are unsafe. |
| Group balance React algorithm | Rewrite | Move authoritative computation into pure tested domain/API code; component becomes presentation only. |
| Settlement Server Action | Rewrite | Add group/party/debt authorization, integer currency, idempotency, versions/reversal, transactions, and tests. |
| Friend request Server Actions | Rewrite | Fix symmetric uniqueness, declined retry, enumeration, concurrency, and activity semantics behind API policy. |
| Group Server Actions | Rewrite | Replace header/revalidation/raw Prisma coupling with authorized services and explicit DTOs. |
| Dashboard Server Action | Rewrite | Replace full in-memory scans/mixed currencies with indexed authorized API queries/read models. |
| Next.js Server Actions for non-domain UI concerns | Retain with modifications | May remain only where they do not bypass the API/domain authority and their security/cache behavior is explicit. |
| Better Auth user profile data | Retain with modifications | Link/migrate approved fields to stable internal users after conflict review. |
| Better Auth runtime/client/route/session proxy | Delete after migration | Clerk web/API replaces it only after account transition and rollback window. |
| Better Auth Session/Account/Verification records | Archive temporarily | Keep read-only for transition/retention; never copy password/token material to Clerk. |
| `src/lib/db.ts` and direct web Prisma access | Rewrite | Move Prisma lifecycle/repositories into API-only database package; eliminate web dependency slice by slice. |
| Prisma 5.22 packages | Retain with modifications | Preserve during behavioral migration; upgrade separately with official guidance and isolated verification. |
| `package.json` web dependencies/scripts | Retain with modifications | Rename workspace and split API/database/contract responsibilities; avoid unrelated upgrades. |
| `pnpm-lock.yaml` | Retain with modifications | Remains authoritative; update only through reviewed dependency changes. |
| `.gitignore` exclusions | Retain with modifications | Preserve secrets/build exclusions; add PWA test/cache/generated artifacts only when implemented. |
| `apps/api/.gitkeep` | Retain unchanged | Keep placeholder until API Foundation initializes it. |
| `apps/mobile/.gitkeep` | Delete after migration | Keep temporarily uninitialized; remove in a separate cleanup after PWA direction/references are confirmed. |
| Expo/NativeWind/EAS assumptions | Archive temporarily | Historical planning only; native may be reconsidered after PWA maturity, not carried into MVP dependencies. |
| `supabase/config.toml` and Supabase CLI dependency | Delete after migration | Unused and target infrastructure is Google Cloud; confirm actual DB provenance first. |
| Ignored generated Prisma output | Delete after migration | Regenerate only from the authoritative API/database package after ownership moves. |
| Current README and planning documentation | Retain with modifications | Replace legacy/native-first language with accurate web/PWA setup, API boundary, release, and runbooks. |
| Existing baseline/monorepo/audit reports | Retain unchanged | Historical evidence remains accurate for its date; PWA strategy change records the new decision. |
| Tests | Rewrite | No legacy behavioral suite exists; add characterization, domain, API, web/PWA, accessibility, security, migration, and deployment coverage. |
| Deployment configuration | Rewrite | None exists; create reviewed Next.js hosting plus Cloud Run/Cloud SQL/GCS/Secret Manager delivery. |

## Reuse summary

The PWA-first strategy materially increases safe client reuse. The repaired Next.js application, App Router structure, web component system, Tailwind styles, forms, query library, routes, and product flows are foundations to harden rather than discard. The unsafe reusable area has not changed: financial arithmetic, authorization, direct Prisma Server Actions, schema design, identity-provider coupling, and untested balance/settlement behavior must be rewritten behind explicit API/domain boundaries.

Keep the working application build throughout migration. Replace one vertical slice at a time, compare behavior/data, retain a rollback path, and delete only after verification and retention gates.

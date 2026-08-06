# Spenza Reuse Matrix

## Classification rules

- **Retain unchanged** — safe artifact or product fact that can remain as-is.
- **Retain with modifications** — useful foundation that requires targeted redesign, decoupling, or hardening.
- **Rewrite** — behavior is useful, but the implementation is coupled, unsafe, or incompatible with the target.
- **Archive temporarily** — keep runnable/readable during migration, then remove from the active product.
- **Delete after migration** — remove only after replacement, reconciliation, rollback, and retention gates pass.

The classification describes the intended final treatment, not permission to change files during this audit.

| Area / important part | Classification | Reuse rationale and required action |
|---|---|---|
| Git history and repository identity | Retain unchanged | Preserve provenance and use tags around migration checkpoints |
| Product name “Spenza” and core expense-sharing concept | Retain unchanged | Subject to trademark/product confirmation; it is the only established brand element |
| Existing internal `User.id` foreign-key identity | Retain unchanged | Keep stable for financial history; add Clerk subject instead of replacing IDs |
| `tsconfig.json` strict-mode intent | Retain with modifications | Preserve strictness through shared configs; split Node, React Native, and legacy variants |
| `.gitignore` secret/build exclusions | Retain with modifications | Preserve protections; extend for pnpm, Expo/EAS local state, coverage, native signing, and generated artifacts |
| Prisma conceptual entities and enums | Retain with modifications | Users, groups, expenses, splits, settlements, notifications, and activity are useful domain vocabulary |
| `prisma/schema.prisma` as production schema | Rewrite | Replace Float money, auth coupling, invite/receipt/notification gaps, cascade policy, and missing audit/idempotency constraints through additive migrations |
| Existing production/internal database records | Retain with modifications | Preserve and reconcile; backfill to redesigned fields after actual-database discovery |
| Group/member relationships and role intent | Retain with modifications | Add lifecycle, invitation, audit, leave/remove, authorization, and indexing semantics |
| Split types EQUAL/EXACT/PERCENTAGE/SHARES | Retain with modifications | Preserve product behavior after rules are specified and rebuilt with deterministic decimal arithmetic |
| `CUSTOM` split enum | Archive temporarily | Do not expose until semantics exist; remove later if product does not approve it |
| Currency list and per-group currency idea | Retain with modifications | Replace hard-coded symbols/free strings with ISO policy and currency-scoped invariants |
| Dashboard metric concepts | Retain with modifications | Keep “you owe/are owed,” trends, and activity after precise definitions and database aggregation |
| Activity action concept | Retain with modifications | Replace mislabeled actions and loose JSON with typed events/audit metadata |
| Screen hierarchy and user-facing copy | Retain with modifications | Use as a product/design brief; rewrite layouts for native navigation, accessibility, and platform conventions |
| `src/actions/expenses.ts` calculation code | Rewrite | Treat only as examples; current code uses Float, trusts participant IDs, accepts broken CUSTOM, and is Next-coupled |
| `src/components/groups/group-balances.tsx` algorithm | Rewrite | Move into pure tested domain code; add currency, deterministic ordering, and authoritative API behavior |
| Friend request behavior | Rewrite | Fix symmetric uniqueness, declined retries, email enumeration, concurrency, and activity semantics |
| Group Server Actions | Rewrite | Replace Next headers/revalidation and raw Prisma returns with authorized service/API contracts |
| Settlement Server Action/UI | Rewrite | Add party/group/debt authorization, idempotency, state policy, currency, confirmation/reversal, and tests |
| Dashboard Server Action | Rewrite | Replace full in-memory scans and mixed-currency aggregation with indexed server queries/read models |
| Zod validation approach | Retain with modifications | Keep Zod, make it a direct dependency, separate input/output schemas, and share transport-safe contracts |
| TanStack Query approach | Retain with modifications | Reuse in Expo with centralized API client, query keys, offline/focus behavior, and mutation idempotency |
| React Hook Form approach | Retain with modifications | Reuse with React Native fields and correct Zod input/output typing |
| `date-fns` | Retain with modifications | Reuse only with explicit UTC/user-time-zone rules |
| `clsx`/class composition ideas | Retain with modifications | Reuse where NativeWind benefits; do not carry DOM utility assumptions |
| Better Auth user profile data | Retain with modifications | Migrate/link safe profile data to internal users after verified conflict handling |
| Better Auth runtime, client, route, proxy session checks | Delete after migration | Clerk Expo/JWT replaces them after account transition and rollback window |
| Better Auth Session/Account/Verification data | Archive temporarily | Keep read-only for transition/retention; never copy passwords/tokens into Clerk; drop only with approval |
| Entire repaired Next app under `apps/web-legacy` | Archive temporarily | Keep as runnable behavioral reference and fallback until mobile/API parity is accepted |
| `src/app` pages/layouts | Rewrite | DOM/Next implementations cannot become Expo Router screens; preserve only flow intent |
| `src/components` feature components | Rewrite | Replace HTML, web dialogs, web charts, and browser form controls with native components |
| `src/components/ui` shadcn/Base UI components | Delete after migration | Web-only and currently type-incompatible; remove after native design system covers required states |
| `globals.css` neutral tokens | Retain with modifications | Extract any approved semantic tokens; define a native-accessible brand system rather than copying CSS |
| `src/lib/db.ts` | Rewrite | Prisma client belongs in API-only database package with correct lifecycle, config, pool, and shutdown behavior |
| `src/lib/utils.ts` `cn` helper | Retain with modifications | A similar helper may remain if NativeWind requires it; do not force web tailwind-merge behavior |
| `package.json` scripts/dependency set | Rewrite | Convert to pnpm workspace scripts and split mobile/API/legacy dependencies by package |
| `package-lock.json` | Delete after migration | Remove only after reviewed, reproducible `pnpm-lock.yaml` succeeds in clean CI |
| Next/React DOM/Base UI/Radix/next-themes dependencies | Delete after migration | Needed only by archived web app; do not place in mobile workspace |
| Recharts, Sonner, Lucide React, Framer Motion | Delete after migration | Replace with RN-compatible chart/feedback/icon/Reanimated choices; Framer Motion is currently unused |
| Tailwind PostCSS and web animation pipeline | Delete after migration | NativeWind requires a mobile-specific configuration, not the current web CSS pipeline |
| Prisma 5.22 packages | Retain with modifications | Keep temporarily for compatibility, then perform a deliberate supported-version migration in API/database packages |
| `supabase/config.toml` and `supabase` CLI dependency | Delete after migration | Application does not use them and target infrastructure is Google Cloud; retain only until actual DB provenance is confirmed |
| Ignored `src/generated/prisma` | Delete after migration | Stale/untracked generated output is not imported; regenerate only from the authoritative API database package |
| Stock `public/*.svg` Next/Vercel assets | Delete after migration | Not Spenza branding and not useful mobile assets |
| Favicon | Archive temporarily | Keep with legacy web; replace with approved mobile/web brand asset set |
| README and current documentation | Rewrite | Replace create-next-app text with monorepo, local environment, architecture, migration, API, deployment, and runbooks |
| Tests | Rewrite | No tests exist; create domain, API, migration, mobile, security, and deployment suites from scratch |
| Deployment configuration | Rewrite | None exists; create Cloud Run/Cloud SQL/GCS/Secret Manager and EAS configuration |

## Reuse summary

The safe reusable core is the product vocabulary, internal record identity, high-level split/group/dashboard behaviors, strict typing intent, and selected cross-platform libraries. Existing executable business code is specification material, not a production library. The web application should be archived as a temporary reference while the domain rules, HTTP API, auth boundary, financial model, and native views are rewritten and verified.


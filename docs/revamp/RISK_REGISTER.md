# Spenza Revamp Risk Register

## Scoring

- **Likelihood:** Low, Medium, High
- **Impact:** Low, Medium, High, Critical
- **Priority:** P0 (release/data blocker), P1 (must mitigate before affected feature rollout), P2 (planned control), P3 (monitor/accept explicitly)

Risks are closed only with recorded evidence, not because implementation work began.

| ID | Priority | Risk and evidence | Likelihood | Impact | Mitigation / exit evidence | Primary phase / owner |
|---|---:|---|---|---|---|---|
| R-01 | P0 | Financial corruption from Prisma/JS `Float` money and ad hoc rounding | High | Critical | Approve decimal/minor-unit policy; deterministic allocation library; property tests; database constraints; full reconciliation before cutover | 6–9 / Data + domain |
| R-02 | P0 | Unauthorized expense/settlement writes because current actions trust payer, participant, group, and payee IDs | High | Critical | Central policy layer; derive actor from verified JWT; re-read membership; BOLA tests; transaction constraints; security review | 4–9 / API + security |
| R-03 | P0 | Checked-in Prisma schema may not match the existing Cloud SQL database; no migrations exist | High | Critical | Read-only inventory/sanitized dump; backup/PITR verification; baseline actual DB; clone rehearsal; drift and reconciliation report | 6 / Data + cloud owner |
| R-04 | P0 | Auth migration can orphan or merge the wrong users; Better Auth credentials are not transferable to Clerk | High | Critical | Keep internal IDs; verified-email conflict report; explicit account-link policy; invitation/reset flow; staged dual-auth period; support runbook | 5 / Identity + product |
| R-05 | P0 | Big-bang rewrite could remove the only behavioral reference and rollback path | Medium | Critical | Strangler plan; repair and archive legacy; vertical slices; feature flags; deployable tags; removal gates | 1–13 / Architecture |
| R-06 | P1 | Mobile retries/offline transitions duplicate expenses or settlements | High | High | Required idempotency keys; actor/operation-scoped records; transactionally cached responses; retry/concurrency tests | 4, 8, 9 / API + mobile |
| R-07 | P1 | Multi-currency totals are meaningless or settlements cross currencies | High | High | Explicit currency on values/aggregates; group policy; reject unsupported conversion; currency-scoped dashboards/balances; fixtures | 6–10 / Product + domain |
| R-08 | P1 | Balance simplification differs from legacy or is nondeterministic; current logic is untested UI code | High | High | Pure server domain engine; deterministic ordering; zero-sum invariants; property/golden/reconciliation tests | 8–9 / Domain |
| R-09 | P1 | Cloud Run instance/concurrency growth exhausts Cloud SQL connections | Medium | Critical | Connection budget formula; pool/instance caps; graceful shutdown; load tests; saturation metrics/alerts; connector policy | 4, 6, 12 / Cloud + API |
| R-10 | P1 | Destructive migration or cascade deletes erase financial history | Medium | Critical | Expand-contract migrations; archival/void policy; remove dangerous cascades; verified backup/restore; explicit destructive-change approval | 6, 13 / Data |
| R-11 | P1 | Secrets leak through Git, mobile binaries, build logs, or structured logs | Medium | Critical | Secret Manager; public/mobile env allowlist; startup validation; Pino redaction; CI/history scanning; rotation runbook; bundle inspection | 1, 3, 4, 12 / Security + cloud |
| R-12 | P1 | Receipt uploads expose private images, permit cross-user access, or enable abusive content/size | Medium | High | Private bucket; authorization before signing; short TTL; random keys; finalize verification; limits/checksum/scanning; lifecycle/deletion tests | 11 / API + cloud + security |
| R-13 | P1 | Clerk verification is misconfigured for issuer/audience/authorized party or webhooks are replayed | Medium | Critical | Supported Clerk verifier; claim matrix tests; webhook signatures; event deduplication; clock-skew policy; key-rotation tests | 5 / Identity + security |
| R-14 | P1 | No existing tests allow silent regressions during extraction | High | High | Restore baseline gates; write characterization fixtures; prioritize financial/auth tests; enforce CI before slice cutovers | 1–12 / QA + all teams |
| R-15 | P1 | Prisma 5 to current major upgrade introduces breaking client/config/runtime behavior | High | High | Isolated database-package upgrade; follow official migration guides; lock version; generate/validate/migrate/test in CI; do not combine with schema cutover | 2, 4, 6 / Data platform |
| R-16 | P1 | Unsupported Node/Expo/React Native/native-library combination blocks builds or store release | Medium | High | Approve version matrix; pin Node LTS/pnpm/Expo SDK; use Expo compatibility checks; Android/iOS preview builds every phase | 1–3, 12 / Mobile platform |
| R-17 | P1 | Existing data contains orphan members/splits, invalid totals, duplicate reverse friendships, or inconsistent currencies | High | High | Read-only data profiling; quarantine report; product-approved correction rules; bounded backfills; pre/post reconciliation | 6–9 / Data + product |
| R-18 | P1 | Financial edits/deletes/settlements lack auditability or legal retention semantics | Medium | High | Decide void/reversal/confirmation policy; immutable audit metadata; retention schedule; privileged action review; export/support tooling | 6–9 / Product + legal + domain |
| R-19 | P2 | Notification retries spam users or expose expense details on lock screens | Medium | High | Transactional outbox; dedup; preferences/quiet hours; safe generic payloads; provider receipt processing; rate caps | 11 / Notifications + privacy |
| R-20 | P2 | Push tokens and device installations become stale, shared, or assigned to the wrong user after sign-out | Medium | High | Installation identity; token rotation/upsert; unregister on sign-out; provider-invalid cleanup; last-seen/revocation; tests across account switching | 11 / Mobile + API |
| R-21 | P2 | Deep links/invitation links can be replayed, guessed, or route users into unauthorized resources | Medium | High | High-entropy token digest; expiry/one-time state; post-navigation authorization; universal/app-link validation; replay tests | 3, 7, 11 / Mobile + API |
| R-22 | P2 | Dashboard/analytics metrics disagree due to date, time-zone, void, settlement, or currency definitions | High | Medium | Written metric contracts; UTC storage/user-zone display; currency filters; golden queries; product sign-off and reconciliation | 10 / Data + product |
| R-23 | P2 | Offline queued financial writes conflict with edits/membership changes | Medium | High | Initially limit offline to cached reads/drafts; add write queue only with idempotency/versioning/conflict UX; explicit expiry | 3, 8, 9 / Mobile + domain |
| R-24 | P2 | GCS objects become orphaned when upload is abandoned or a database transaction fails | High | Medium | Upload-intent/finalize states; lifecycle cleanup; reconciliation job; object metadata; idempotent delete/finalize | 11 / Cloud + API |
| R-25 | P2 | Rate limiting is ineffective or blocks all users behind a proxy/NAT | Medium | High | Correct trust-proxy config; actor plus IP keys; route-specific limits; distributed backend if multi-instance; metrics and bypass runbook | 4, 12 / API + security |
| R-26 | P2 | PII/financial notes enter logs, analytics, crash reports, or notification providers | Medium | High | Data classification; allowlisted telemetry; redaction tests; sampling/retention rules; consent/privacy review; provider DPAs | 4, 10–12 / Privacy + security |
| R-27 | P2 | Cloud/provider outage leaves writes partially applied or side effects lost | Medium | High | Database transaction + outbox; bounded timeouts/retries; circuit behavior; degraded UX; outage runbooks; restore drills | 4, 11, 12 / SRE + API |
| R-28 | P2 | Mobile app-store review/signing/privacy requirements delay release | Medium | High | Assign Apple/Google/EAS ownership early; preview builds; privacy manifests/declarations; permission rationale; staged store checklist | 3, 12 / Release + product |
| R-29 | P2 | Missing approved branding/assets blocks app icon, splash, store listing, or creates inconsistent UI | High | Medium | Brand brief and asset owner; accessible token review; icon/splash/store asset deadlines; temporary assets never ship to production | 3, 12 / Design + product |
| R-30 | P2 | Legacy and new systems dual-write different results | Medium | Critical | Prefer single authoritative writer per cohort; idempotent event handoff; reconciliation dashboards; kill switch; limited dual-write duration | 7–10 / Architecture + data |
| R-31 | P2 | Friend/group invitation workflows allow email enumeration or abuse | Medium | Medium | Generic responses; quotas/rate limits; privacy-aware discovery; block/report policy; audit; invitation expiry | 5, 7 / Product + security |
| R-32 | P2 | Database query performance degrades with activity/expense history | Medium | High | Cursor pagination; composite indexes; representative data/load tests; query budgets; explain-plan review; archive/read-model strategy | 6–10 / Data + API |
| R-33 | P3 | Current neutral UI and stock assets provide little differentiated product identity | High | Low | Product/design discovery; retain name/copy only; create accessible native design system and approved assets | 3 / Design |
| R-34 | P2 | Legacy removal occurs while clients still depend on old endpoints/auth | Medium | High | Telemetry by client/app version; minimum-version/kill-switch policy; zero-traffic observation; immutable legacy artifact; explicit sign-off | 13 / Release + architecture |

## Immediate blockers before implementation

1. Confirm the existing database's status and obtain a safe read-only inventory path.
2. Decide the money/currency model before writing new financial tables or endpoints.
3. Decide the Clerk account-link and existing-password-user transition.
4. Assign Google Cloud, Apple, Google Play, Clerk, Expo/EAS, security, and product owners.
5. Restore a passing legacy quality baseline so migration regressions can be distinguished from pre-existing failures.

## Review cadence

- Review P0/P1 risks at every phase gate and production release decision.
- Review security/privacy risks during API contract and data-model changes, not only at final testing.
- Add newly discovered risks with evidence, owner, mitigation, and exit criteria.
- Record accepted residual risks and expiry dates; unowned Critical/High risks block the affected rollout.


# Spenza Revamp Risk Register

## Scoring

- **Likelihood:** Low, Medium, High
- **Impact:** Low, Medium, High, Critical
- **Priority:** P0 release/data blocker, P1 mitigate before affected rollout, P2 planned control, P3 monitor/accept explicitly

Risks close only with recorded evidence. Phase numbers refer to the revised PWA-first milestones.

| ID | Priority | Risk and evidence | Likelihood | Impact | Mitigation / exit evidence | Primary milestone / owner |
| --- | ---: | --- | --- | --- | --- | --- |
| R-01 | P0 | Financial corruption from current Prisma/JS `Float` money and ad hoc rounding | High | Critical | Approve minor-unit policy; pure deterministic engine; property tests; constraints; full reconciliation before cutover | 6, 8–11 / Data + domain |
| R-02 | P0 | Unauthorized expense/settlement writes because current actions trust payer, participant, group, and payee IDs | High | Critical | Central API policy; verified JWT actor; membership re-read; BOLA tests; transaction constraints; security review | 4–9 / API + security |
| R-03 | P0 | Checked-in Prisma schema may not match Cloud SQL and no migration history exists | High | Critical | Read-only inventory/sanitized dump; backup/PITR verification; actual-DB baseline; clone rehearsal; drift/reconciliation report | 6 / Data + cloud owner |
| R-04 | P0 | Clerk migration can orphan or merge users; Better Auth credentials are not transferable | High | Critical | Stable internal IDs; verified-email conflict report; explicit linking policy; invitation/reset path; compatibility period; support runbook | 5–6 / Identity + product |
| R-05 | P0 | Deleting/rebuilding the working Next.js app would lose the only validated client and rollback path | Medium | Critical | Promote mechanically; characterization tests; vertical API slices; parity gates; deployable tags; no wholesale rewrite | 1–13 / Architecture |
| R-06 | P1 | Browser retry/double-click/reconnect duplicates expenses or settlements | High | High | One idempotency key per explicit intent; disable duplicate submit; transactionally stored results; concurrency/retry tests | 4, 8–9 / API + web |
| R-07 | P1 | Service worker or Background Sync replays financial mutations after state/membership changes | Medium | Critical | Never intercept/cache/queue mutations; no Background Sync; online gate; automated cache/fetch tests and bundle inspection | 3, 8–9, 13 / PWA + domain |
| R-08 | P1 | Service-worker/CDN caches leak private API, HTML, receipt, auth, or signed-URL data across users | Medium | Critical | Explicit allowlist; private/no-store headers; exclude auth/private/RSC/receipts; account-switch tests; cache inspection | 3–5, 12–13 / PWA + security |
| R-09 | P1 | A stale installed PWA runs incompatible code against newer API/contracts | Medium | High | Build/version telemetry; backward compatibility window; safe update prompt; no forced mid-write activation; rollback/version tests | 3–4, 13 / Web + API |
| R-10 | P1 | XSS steals sessions or financial data from a high-value browser origin | Medium | Critical | CSP; semantic text rendering; no untrusted HTML; dependency review; HttpOnly session cookies; XSS/security tests | 2–5, 13 / Web + security |
| R-11 | P1 | CSRF or CORS misconfiguration permits unauthorized browser writes | Medium | Critical | Select auth/topology; secure SameSite cookies; CSRF/origin checks where applicable; explicit origin allowlist; negative tests | 4–5, 13 / API + security |
| R-12 | P1 | Browser storage or query persistence exposes tokens/private data on shared devices or account switch | Medium | High | No token persistence; in-memory server state by default; clear account state; storage inventory/tests; privacy review for drafts | 2–5 / Web + security |
| R-13 | P1 | Multi-currency totals become meaningless or settlements cross currencies | High | High | Explicit currency on every value/aggregate; group policy; reject conversion; currency-scoped dashboards/balances; fixtures | 6–11 / Product + domain |
| R-14 | P1 | Balance suggestion differs from legacy or is nondeterministic; current logic is untested UI code | High | High | Pure server engine; deterministic ordering; zero-sum properties; golden/reconciliation tests; label suggestions non-authoritative | 8–9 / Domain |
| R-15 | P1 | Cloud Run scaling exhausts Cloud SQL connections | Medium | Critical | Connection budget; pool/instance caps; shutdown; load tests; saturation metrics/alerts; connector policy | 4, 6, 13 / Cloud + API |
| R-16 | P1 | Destructive migration or cascade deletes erase financial history | Medium | Critical | Expand-contract; archive/void policies; remove dangerous cascades; verified backup/restore; explicit approval | 6, 8–9 / Data |
| R-17 | P1 | Secrets leak through Git, browser bundles, service worker, build logs, or runtime logs | Medium | Critical | Secret Manager; `NEXT_PUBLIC_*` allowlist; environment validation; redaction; history/bundle scans; rotation runbook | 1, 3–5, 13 / Security + cloud |
| R-18 | P1 | Receipt uploads expose images, enable cross-user access, or accept malicious content | Medium | High | Private bucket; authorization before signing; short TTL; random keys; metadata/signature/size checks; CORS/lifecycle/scanning tests | 12 / API + cloud + security |
| R-19 | P1 | Clerk issuer/audience/authorized-party or webhook verification is misconfigured | Medium | Critical | Supported verifier; claim matrix; webhook signatures/event dedup; clock/key-rotation tests | 5–6 / Identity + security |
| R-20 | P1 | No existing behavioral tests allow silent regressions while retaining/refactoring web code | High | High | Characterization fixtures; visual/accessibility tests; prioritize auth/financial tests; enforce CI before cutovers | 1–13 / QA + all teams |
| R-21 | P1 | Prisma 5 upgrade introduces breaking client/config/runtime behavior | High | High | Isolated database-package upgrade; official guide; locked version; generate/validate/migrate/integration tests; separate from schema cutover | 4, 6 / Data platform |
| R-22 | P1 | Existing data has orphan members/splits, invalid totals, reverse friendships, or inconsistent currencies | High | High | Read-only profiling; quarantine report; approved corrections; bounded backfills; pre/post reconciliation | 6–9 / Data + product |
| R-23 | P1 | Financial edits/voids/settlements lack auditability or retention semantics | Medium | High | Decide policies; immutable events; actor/version/idempotency; retention review; privileged-action tests | 6, 8–9 / Product + legal + domain |
| R-24 | P2 | Browser installability differs by Chrome, Edge, Android, Safari, enterprise policy, and user settings | High | Medium | Supported matrix; feature detection; normal web fallback; platform installation guidance; manual device checks | 3, 13 / PWA + product |
| R-25 | P2 | iOS/iPadOS users expect automatic install/native parity, but Add to Home Screen and lifecycle behavior differ | High | Medium | Accurate manual guidance; standalone/Home Screen tests; no native-parity claims; graceful browser-tab experience | 3, 12–13 / Product + QA |
| R-26 | P2 | Web Push is unsupported, denied, stale, or associated with the wrong account/browser | High | High | User-gesture request; capability fallback; per-installation subscription; rotation/unsubscribe/sign-out handling; in-app fallback | 12 / Notifications + privacy |
| R-27 | P2 | Notifications spam users or expose expense details on lock screens | Medium | High | Transactional outbox; dedup; preferences; generic payloads; provider results; rate caps; privacy review | 12 / Notifications + privacy |
| R-28 | P2 | Bad PWA update causes reload loops, mixed assets, broken install, or lost in-progress form state | Medium | High | Versioned caches/assets; waiting-update UX; activate at safe boundary; controllerchange guard; forward rollback rehearsal | 3, 13 / PWA + release |
| R-29 | P2 | Offline fallback or stale UI misleads users into believing data/write is current or saved | Medium | High | Explicit offline/stale/unsaved indicators; disable writes; no cached private dashboard; usability tests | 3, 7–11 / Web + product |
| R-30 | P2 | GCS objects become orphaned when browser upload is abandoned or finalize fails | High | Medium | Upload intent/finalize states; lifecycle cleanup; reconciliation job; checksums; idempotent finalize/delete | 12 / Cloud + API |
| R-31 | P2 | Rate limiting blocks shared NAT users or trusts forged proxy headers | Medium | High | Correct trust proxy; actor+IP keys; route limits; distributed backend; metrics/bypass runbook | 4, 13 / API + security |
| R-32 | P2 | PII/financial notes enter logs, analytics, crash tools, Push providers, or browser caches | Medium | High | Data classification; allowlisted telemetry; redaction/cache tests; retention/consent; provider review | 4, 10–13 / Privacy + security |
| R-33 | P2 | Provider outage leaves writes partially applied or side effects lost | Medium | High | DB transaction+outbox; timeouts/retries; degraded UX; no client replay; outage runbooks/restore drills | 4, 12–13 / SRE + API |
| R-34 | P2 | Next.js hosting choice lacks required runtime, cache control, rollback, or observability behavior | Medium | High | Decide host/topology early; staging proof; runtime/cache/header tests; staged deployments; provider exit/rollback plan | 1, 3, 13 / Web platform |
| R-35 | P2 | Existing direct Next.js Prisma/Server Actions remain indefinitely and bypass API policies | High | Critical | Domain migration inventory; dependency rule; one authoritative writer per slice; parity/reconciliation gate; removal checklist | 4–12 / Architecture + security |
| R-36 | P2 | Dashboard/analytics disagree due to date, time zone, void, settlement, or currency definitions | High | Medium | Written metric contracts; UTC/user-zone display; currency filters; golden queries; product sign-off | 10–11 / Data + product |
| R-37 | P2 | Invitation/deep links can be replayed, guessed, cached, or route to unauthorized resources | Medium | High | High-entropy digest; expiry/one-time state; no SW cache; post-navigation authorization; replay tests | 5, 7, 12 / Web + API |
| R-38 | P2 | Database query performance degrades with history | Medium | High | Cursor pagination; composite indexes; representative load/query plans; budgets; rebuildable read models | 7–11 / Data + API |
| R-39 | P2 | Missing brand icons/colors blocks manifest quality or causes poor maskable/iOS presentation | High | Medium | Brand owner; source asset; mask/small-size/device validation; placeholders prohibited from production | 3, 13 / Design + product |
| R-40 | P2 | Native scope returns prematurely and fragments MVP delivery | Medium | High | Keep Expo uninitialized; remove placeholder after confirmation; native requires post-PWA evidence/product brief and separate milestone | 1, 14 / Product + architecture |
| R-41 | P2 | Existing/new paths dual-write different results during API extraction | Medium | Critical | One authoritative writer per cohort; idempotent handoff; reconciliation dashboard; kill switch; bounded overlap | 7–11 / Architecture + data |
| R-42 | P3 | Current neutral UI/stock assets provide little differentiated identity | High | Low | Product/design discovery; retain working UI; establish accessible responsive brand tokens/assets before PWA release | 2–3 / Design |

## Immediate blockers before implementation

1. Confirm the existing database status and obtain a safe read-only inventory path before schema/identity work.
2. Confirm supported browser/OS matrix, accessibility target, and installed-PWA support window.
3. Select Next.js hosting, public domains, CDN policy, and same-origin versus cross-origin API topology.
4. Approve PWA icon/maskable icon assets, final theme/background colors, and installation copy.
5. Decide Clerk web session/token topology and Better Auth account-linking transition.
6. Decide the money/currency and remaining product policies before financial tables/endpoints.
7. Assign Google Cloud, Next.js hosting, Clerk, Web Push/VAPID, security, accessibility, product, and release owners.
8. Decide whether privacy-reviewed unsaved browser drafts are allowed; offline financial writes remain prohibited.

## Review cadence

- Review P0/P1 risks at every phase gate and production release decision.
- Review PWA cache/update risks whenever routing, authentication, response caching, service workers, or hosting/CDN changes.
- Review security/privacy risks during contract/data-model work, not only final testing.
- Add newly discovered risks with evidence, owner, mitigation, and exit criteria.
- Record accepted residual risks and expiry dates; unowned Critical/High risks block the affected rollout.

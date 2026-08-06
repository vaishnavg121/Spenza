# Spenza PWA Requirements

## Purpose

This document defines the MVP contract for making the responsive Next.js application installable and reliable as a Progressive Web App without pretending that it is a fully offline financial application. Product scope remains in `docs/PRODUCT_SCOPE.md`; security and financial rules remain authoritative in their respective documents.

## Application identity and manifest

The Web App Manifest must be generated or served by the Next.js App Router and linked from every applicable application document.

| Manifest field | MVP requirement |
| --- | --- |
| `id` | `/`; stable across releases and environments within one origin |
| `name` | `Spenza` |
| `short_name` | `Spenza` |
| `description` | Concise approved expense-sharing description with no unsupported claims |
| `start_url` | `/`; authentication and post-login routing happen after launch |
| `scope` | `/`; do not claim routes outside the application origin |
| `display` | `standalone` |
| `display_override` | Optional progressive enhancement only after browser testing; must fall back to `standalone` |
| `orientation` | Omit so phone, tablet, and desktop layouts work in any orientation |
| `lang` | Approved default locale, initially `en` unless product selects another |
| `theme_color` | Preliminary neutral brand value `#111827`, subject to final design approval |
| `background_color` | Preliminary launch background `#FFFFFF`, with an approved dark-mode launch treatment where the platform supports it |
| `prefer_related_applications` | `false` or omitted for the web-first MVP |

- Use stable same-origin absolute or root-relative URLs.
- Validate MIME type and manifest schema in CI and browser tooling.
- Do not place secrets, environment-specific private identifiers, or user data in the manifest.
- Use color-scheme-aware HTML `theme-color` metadata where supported; manifest values remain safe static defaults.

## Icons and launch assets

- Provide PNG icons at minimum `192x192` and `512x512` with purpose `any`.
- Provide a separate safe-zone-tested `512x512` maskable PNG with purpose `maskable`; do not reuse an edge-to-edge icon without mask testing.
- Provide `apple-touch-icon` assets because iOS/iPadOS may prefer them over manifest icons.
- Provide a favicon appropriate for browser tabs and desktop bookmarks.
- Keep source artwork in a reviewable high-resolution/vector form and generate raster sizes deterministically.
- Verify legibility at small sizes, high contrast, transparent/solid backgrounds, Android masks, desktop shortcuts, and iOS Home Screen presentation.
- Placeholder artwork must not ship to production without design/product approval.

## HTTPS and origin requirements

- Production and staging PWA surfaces use HTTPS. HTTP is allowed only for loopback local development where browsers permit PWA APIs.
- Redirect HTTP to HTTPS at the edge and enable HSTS only after domain and subdomain behavior is verified.
- The manifest, service worker, icons, application shell, API, Clerk callbacks, and signed-upload CORS policy must use reviewed origins.
- Choose the production Next.js hosting platform and same-origin/cross-origin API topology before authentication and service-worker implementation.

## Service-worker registration and scope

- Register the service worker only in supported browser contexts and only in production-like builds unless a developer explicitly enables it for testing.
- Register from the application root with scope `/`; do not broaden scope through headers without review.
- Registration failure must not prevent the online application from loading.
- Expose observable registration, install, activate, and update failures without logging private data.
- Keep service-worker code minimal, deterministic, versioned, and covered by tests. Prefer a maintained integration only after its generated behavior is inspected and constrained.

## Safe caching strategy

Use an explicit request-method, origin, destination, and path allowlist.

| Resource | MVP strategy |
| --- | --- |
| Content-hashed JS/CSS/fonts and approved static icons | Cache-first with immutable versioned URLs |
| Manifest and small public metadata | Network-first or short stale-while-revalidate with bounded expiry |
| Top-level navigation | Network-first; fall back to the static offline document only on network failure |
| Public marketing assets | Reviewed stale-while-revalidate policy |
| Authenticated API responses | Never service-worker-cache; API sends `private, no-store` |
| Auth routes/callbacks and session endpoints | Never cache |
| User-specific HTML/RSC payloads | Never cache unless a later threat model and partitioning design explicitly approves it |
| Signed receipt URLs, receipt bodies, upload requests | Never cache |
| `POST`, `PUT`, `PATCH`, `DELETE` and mutation responses | Never cache or replay |
| Push subscription payloads | Never cache |

- Cache only successful responses with expected origin, type, and bounded size.
- Version cache names. On activation, remove only known obsolete Spenza caches.
- Do not use a catch-all runtime rule.
- CDN/Next.js caching and service-worker caching must be designed together to prevent stale private data or incompatible app shells.

## Offline fallback and online-only writes

- When navigation fails offline, show a static, accessible fallback that says Spenza needs a connection for current data and financial changes.
- The fallback contains no account, group, balance, receipt, or other user data.
- Existing already-rendered UI may remain visible during a brief outage, but stale status and disabled write controls must be obvious.
- Expense create/edit/void, settlement/reversal, membership changes, invitations, receipt finalization, profile changes, and other protected writes require a live network connection.
- Do not use Background Sync, service-worker queues, persisted mutation caches, or automatic reconnect submission for financial writes in MVP.
- A locally retained draft, if separately approved, is labeled unsaved, is privacy-reviewed, has an expiry/clear path, and requires a fresh explicit submit after reconnection.

## Update and version handling

- Identify every web release with a non-secret build/version value available to diagnostics and API compatibility telemetry.
- Install service-worker updates in the background, but do not force activation while a form submission or mutation is in flight.
- When a new version is waiting, show a clear update action; reload only after the user accepts or at a safe idle boundary.
- Handle `controllerchange` once and prevent reload loops.
- Keep the API backward compatible with the supported window of open tabs and installed PWA versions.
- Test rollback from a bad web/service-worker release. A rollback must use a new cache/build version rather than depending on clients to discard caches manually.
- Provide user-facing recovery guidance for a persistently stale installation without asking users to clear all browser data as the primary path.

## Installability and platform expectations

### Android

- Supporting Chromium browsers can promote installation when manifest and secure-origin requirements are met; exact UI and prompt timing remain browser-controlled.
- Provide an in-app install affordance only when the relevant event/capability is available and after a meaningful user interaction.
- Installed Android presentation must pass icon/mask tests, standalone navigation, back behavior, rotation, keyboard, file upload, and notification permission checks.
- Do not promise Play Store listing or native capabilities in MVP.

### Desktop Chrome and Edge

- The PWA should be installable into a standalone desktop window on supported Chrome and Edge versions.
- Test launch from OS shortcuts, resizing from narrow to wide windows, multi-window behavior, external links, authentication callbacks, updates, and uninstall/reinstall.
- Browser menu or address-bar installation remains available even if a custom install prompt is not.

### iPhone and iPad

- Document the manual Share menu → Add to Home Screen path; do not promise an automatic install prompt.
- A manifest with `display: standalone` enables supported Home Screen web-app behavior. Provide `apple-touch-icon` assets.
- Treat Home Screen installation, browser-tab use, and private browsing as distinct capability states.
- Web Push is available only on supported iOS/iPadOS versions for Home Screen web apps and only after a direct user gesture grants permission. Always use feature detection.
- Do not imply native-app parity; browser/OS lifecycle, storage eviction, background execution, file handling, and notification behavior remain platform-controlled.

## Push-notification capability differences

- Web Push requires Service Worker, Push API, Notifications API, a server-side subscription/delivery implementation, user permission, and platform support.
- Desktop Chrome/Edge and supported Android browsers can provide web notifications, but enterprise policy, browser settings, or OS settings may disable them.
- On iOS/iPadOS, plan for supported Home Screen web applications rather than ordinary browser tabs and request permission only from an explicit user action.
- Store a subscription per browser installation. Handle rotation, unsubscribe, provider rejection, account switch, and sign-out.
- Notification payloads remain generic and privacy-safe. Opening a notification reauthenticates/re-authorizes before showing the target.
- Lack of support or denied permission degrades to in-app activity/unread indicators; no core feature depends on push.

## Responsive layout requirements

Use content-driven breakpoints and verify at least these planning ranges:

| Range | Planning intent |
| --- | --- |
| `< 640px` | Phone-first single-column layout, compact navigation, no horizontal page scrolling |
| `640px–1023px` | Large phone/tablet layouts with increased spacing and selective two-column composition |
| `>= 1024px` | Desktop navigation, bounded content widths, multi-column summaries where readable |
| `>= 1440px` | Preserve readable line lengths and density; do not stretch forms/tables without bounds |

- Breakpoints are implementation hypotheses, not device detection. Test intermediate widths, zoom, landscape, split-screen, and installed-window resizing.
- No capability or financial information may disappear solely because the viewport is small.
- Tables must have a responsive semantic alternative or controlled scrolling with preserved labels.

## Touch, keyboard, and accessibility requirements

- Target at least `44x44` CSS pixels for primary interactive touch targets and preserve sufficient separation between destructive/adjacent actions.
- Every action works by keyboard with logical focus order and a visible focus indicator.
- Use semantic landmarks, headings, buttons, links, labels, tables, dialogs, and live regions before ARIA workarounds.
- Dialogs trap/restore focus correctly; route changes and validation errors announce useful context.
- Support screen zoom/reflow, text resizing, reduced motion, high contrast/forced colors where practical, and light/dark/OLED contrast requirements.
- Do not encode owed/owing direction, status, or validation by color alone.
- Set an approved WCAG target before release; WCAG 2.2 AA is the recommended baseline.

## Required validation

- Manifest schema, icon sizes/purpose, start URL, scope, display mode, colors, and HTTPS.
- Service-worker install/activate/fetch/update/rollback behavior and cache allowlist.
- Proof that no authenticated API, receipt, auth, mutation, or push-subscription response enters Cache Storage.
- Offline navigation fallback and disabled online-only financial writes.
- Lighthouse or equivalent PWA/accessibility checks as diagnostics, plus manual browser testing; a score alone is not acceptance.
- Install/update/uninstall checks on approved Android, desktop Chrome, desktop Edge, iPhone, and iPad targets where available.
- Responsive, keyboard, screen-reader, zoom, contrast, reduced-motion, and touch-target checks.
- Web Push allow/deny/unsupported/subscription-rotation/deep-link flows on supported platform representatives.

## Current limitations and non-promises

- Install prompts, badges, push delivery, background lifetime, and update timing are controlled partly by browsers and operating systems.
- iOS/iPadOS installation is user-driven through Add to Home Screen; support differs from Chromium installation UX.
- Offline access is limited to a public fallback and reviewed static assets. Current financial data and protected writes require connectivity.
- The MVP is not distributed as a native iOS or Android binary and does not promise native API parity.
- Store packaging for Microsoft Store or Google Play is not part of the initial release unless separately approved.

## Reference baseline

- [MDN: Making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- [Microsoft Edge: Get started developing a PWA](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/)
- [WebKit: Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)

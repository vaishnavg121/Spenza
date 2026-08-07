# Spenza PWA Foundation Report

**Date:** August 6, 2026  
**Milestone:** Milestone 3 — PWA Foundation and Installation

---

## Outcome

Milestone 3 established the Web App Manifest, PWA icons, root Service Worker (`/sw.js`), static offline fallback page (`/offline`), online/offline status UI, update handling, and installation experiences across Android, Desktop Chromium, and iOS Safari targets.

No financial API responses, authenticated user payloads, or mutation requests are cached or queued offline. Financial writes remain online-only. Better Auth, Prisma schema, server actions, and backend logic were not altered.

---

## Files Created / Modified

### Created Files
* `apps/web/src/app/manifest.ts` - Next.js Web App Manifest route returning `/manifest.webmanifest`.
* `apps/web/src/app/offline/page.tsx` - Static offline fallback page containing no private user data.
* `apps/web/public/sw.js` - Root-scoped service worker with versioned cache allowlist.
* `apps/web/public/icons/icon-192x192.png` - 192x192 PNG PWA icon (`purpose: "any"`).
* `apps/web/public/icons/icon-512x512.png` - 512x512 PNG PWA icon (`purpose: "any"`).
* `apps/web/public/icons/maskable-icon-512x512.png` - Safe-zone 512x512 PNG maskable icon (`purpose: "maskable"`).
* `apps/web/public/icons/apple-touch-icon.png` - 180x180 PNG iOS touch icon.
* `apps/web/public/icons/icon.svg` - Scalable vector SVG icon.
* `apps/web/public/icons/maskable-icon.svg` - Scalable vector SVG maskable icon.
* `apps/web/src/components/pwa/pwa-manager.tsx` - Root PWA lifecycle & registration manager.
* `apps/web/src/components/pwa/offline-banner.tsx` - Sticky offline status banner.
* `apps/web/src/components/pwa/update-prompt.tsx` - Service worker update notification & skip-waiting trigger.
* `apps/web/src/components/pwa/install-prompt.tsx` - User-triggered `beforeinstallprompt` banner for Chromium/Android.
* `apps/web/src/components/pwa/ios-install-guide.tsx` - iOS Safari "Add to Home Screen" Share menu guidance.
* `docs/revamp/PWA_FOUNDATION_REPORT.md` - Execution report.

### Modified Files
* `apps/web/src/app/layout.tsx` - Added PWA icons, `viewport` theme colors, and `appleWebApp` metadata.
* `apps/web/src/components/providers.tsx` - Mounted `<PwaManager />` inside the shared client providers.

---

## Manifest Configuration

* **Name:** `Spenza`
* **Short Name:** `Spenza`
* **ID / Scope / Start URL:** `/`
* **Display Mode:** `standalone`
* **Background Color:** `#111827`
* **Theme Color:** `#111827`
* **Icons:**
  * `/icons/icon-192x192.png` (`192x192`, `image/png`, `purpose: "any"`)
  * `/icons/icon-512x512.png` (`512x512`, `image/png`, `purpose: "any"`)
  * `/icons/maskable-icon-512x512.png` (`512x512`, `image/png`, `purpose: "maskable"`)

---

## Service Worker Strategy & Cache Exclusions

* **Registration:** Scope `/` via `/sw.js`, registered on client window load.
* **Pre-cached Assets:** `/`, `/offline`, `/manifest.webmanifest`, `/icons/*`.
* **Navigation Requests (`request.mode === 'navigate'`):** Network-first. If network fetch fails (offline), serves cached `/offline` static page.
* **Static Assets (`/_next/static/*`, `/icons/*`, `.png`, `.svg`):** Cache-first with network fallback.
* **Cache Name & Rotation:** `spenza-pwa-v1`. On activation, deletes obsolete `spenza-*` caches and claims clients.

### Strict Cache Exclusions
1. **Mutations:** Non-`GET` HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) bypass the service worker completely.
2. **API & Private Routes:** `/api/*` (including `/api/auth/*`), dynamic RSC data payloads (`/_next/data/*`), signed upload requests, and receipts are never cached.
3. **Cross-Origin Requests:** Requests to non-same-origin URLs are excluded.
4. **No Offline Financial Writes:** No Background Sync, IndexedDB mutation queue, or offline write replay exists.

---

## Installation Behavior

* **Desktop Chromium (Chrome/Edge) & Android:**
  * Captures `beforeinstallprompt` event and holds deferred prompt.
  * Displays a non-intrusive "Install Spenza" card with an explicit "Install" button.
  * Hides automatically when running in standalone mode (`display-mode: standalone`).
  * Persists user dismissal in `localStorage` (`spenza_pwa_install_dismissed`) to avoid nagging.
* **iOS / iPadOS Safari:**
  * Detects iOS Safari browser mode (non-standalone).
  * Displays guidance explaining: *Tap Share -> "Add to Home Screen"*.
  * Explicitly avoids claiming iOS Chrome supports direct PWA installation prompts.

---

## Offline Behavior

* **Offline Navigation:** When internet connectivity is lost, top-level page navigations return the `/offline` fallback page containing zero private user data or financial balances.
* **Offline Status Banner:** A sticky top banner alerts users when `navigator.onLine` is `false`, making read-only status explicit.
* **Online-Only Write Enforcement:** All financial actions remain online-only.

---

## Validation Results

| Gate / Command | Status | Notes |
| :--- | :--- | :--- |
| `pnpm lint` | **PASS** | 0 errors / 0 warnings across all workspace projects. |
| `pnpm typecheck` | **PASS** | Strict TypeScript `tsc --noEmit` passed with 0 errors. |
| `pnpm test` | **PASS** | 0 failures. |
| `pnpm prisma:validate` | **PASS** | Schema `apps/web/prisma/schema.prisma` is valid. |
| `pnpm build:web` | **PASS** | Next.js 16.3.0 compiled cleanly; generated `/manifest.webmanifest` and `/offline` routes. |

---

## Manual Verification Instructions

Because headless CLI environments do not execute an interactive browser profile, perform the following manual checks in Chrome, Edge, and iOS Safari:

1. **Chrome / Edge Desktop PWA Install:**
   * Launch `pnpm dev:web` and open `http://localhost:3000`.
   * Verify the install icon appears in the browser address bar and the "Install Spenza" banner renders.
   * Click "Install" and verify Spenza opens in a standalone window without browser chrome.
2. **Offline Navigation Check:**
   * In Chrome DevTools, open the **Application** tab -> **Service Workers**.
   * Toggle **Offline** mode and click links or refresh.
   * Confirm the `/offline` fallback renders cleanly with no user data leaks.
3. **Network / Cache Audit:**
   * In DevTools **Application** tab -> **Cache Storage**, inspect `spenza-pwa-v1`.
   * Verify only static assets and `/offline` exist; confirm no `/api/` or user responses are cached.
4. **iOS Safari Home Screen Verification:**
   * Open the app in iOS Safari, tap **Share** -> **Add to Home Screen**.
   * Launch from iOS Home Screen and verify standalone launch behavior and theme color.

---

## Confirmation

* Authentication (Better Auth), database schema (Prisma), server actions, Express placeholder, and financial calculation logic were **not modified**.
* No files were committed and Milestone 4 was **not started**.

"use client";

import { useEffect } from "react";
import { OfflineBanner } from "@/components/pwa/offline-banner";
import { UpdatePrompt } from "@/components/pwa/update-prompt";
import { InstallPrompt } from "@/components/pwa/install-prompt";
import { IosInstallGuide } from "@/components/pwa/ios-install-guide";

export function PwaManager() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isDev =
      process.env.NODE_ENV === "development" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // In development mode, strictly unregister service workers and purge Spenza caches
    if (isDev) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          const scriptURL =
            registration.active?.scriptURL ||
            registration.installing?.scriptURL ||
            registration.waiting?.scriptURL ||
            "";
          if (
            scriptURL.includes("sw.js") ||
            registration.scope === window.location.origin + "/" ||
            registration.scope.includes("localhost")
          ) {
            registration.unregister();
          }
        }
      });
      if ("caches" in window) {
        caches.keys().then((cacheNames) => {
          for (const cacheName of cacheNames) {
            if (cacheName.startsWith("spenza-")) {
              caches.delete(cacheName);
            }
          }
        });
      }
      return;
    }

    // Register root service worker in production only
    const registerSw = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          // Registration failures must fail silently without blocking online app
          if (process.env.NODE_ENV === "development") {
            console.warn("Service worker registration error:", error);
          }
        });
    };

    if (document.readyState === "complete") {
      registerSw();
    } else {
      window.addEventListener("load", registerSw);
    }
  }, []);

  return (
    <>
      <OfflineBanner />
      <UpdatePrompt />
      <InstallPrompt />
      <IosInstallGuide />
    </>
  );
}

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

    // Register root service worker
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((error) => {
          // Registration failures must fail silently without blocking online app
          if (process.env.NODE_ENV === "development") {
            console.warn("Service worker registration error:", error);
          }
        });
    });
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

"use client";

import { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const handleServiceWorkerUpdate = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaitingWorker(reg.waiting);
        setShowUpdate(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker);
            setShowUpdate(true);
          }
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        handleServiceWorkerUpdate(reg);
      }
    });

    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  const handleRefresh = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } else {
      window.location.reload();
    }
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-16 right-4 sm:bottom-4 z-50 max-w-sm rounded-lg border border-emerald-500/30 bg-card p-4 shadow-lg text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
            <RefreshCw className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-semibold">Update Available</h4>
            <p className="text-xs text-muted-foreground">A new version of Spenza is ready.</p>
          </div>
        </div>
        <button
          onClick={() => setShowUpdate(false)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close update notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          size="sm"
          onClick={handleRefresh}
          className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[36px] text-xs"
        >
          Refresh Now
        </Button>
      </div>
    </div>
  );
}

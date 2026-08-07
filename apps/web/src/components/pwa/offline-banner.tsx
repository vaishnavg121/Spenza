"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return typeof navigator !== "undefined" ? !navigator.onLine : false;
}

function getServerSnapshot() {
  return false;
}

export function OfflineBanner() {
  const isOffline = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-50 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all z-50 sticky top-0"
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" />
      <span>
        You are currently offline. Viewing mode active; submitting changes requires internet.
      </span>
    </div>
  );
}

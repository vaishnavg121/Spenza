"use client";

import { useState, useEffect } from "react";
import { Share, PlusSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function IosInstallGuide() {
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);

    const isSafari = isIos && /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|mercury/.test(ua);
    const isDismissed = localStorage.getItem("spenza_ios_guide_dismissed");

    if (isIos && isSafari && !isStandalone && !isDismissed) {
      const handle = requestAnimationFrame(() => {
        setShowIosGuide(true);
      });
      return () => cancelAnimationFrame(handle);
    }
  }, []);

  const handleDismiss = () => {
    setShowIosGuide(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("spenza_ios_guide_dismissed", "true");
    }
  };

  if (!showIosGuide) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-40 max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl text-card-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span>Install Spenza on iOS</span>
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap the <Share className="inline h-3.5 w-3.5 text-emerald-500" /> Share button in Safari, then select <PlusSquare className="inline h-3.5 w-3.5 text-emerald-500" /> &quot;Add to Home Screen&quot;.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close iOS install guide"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={handleDismiss}
          className="text-xs min-h-[32px]"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}

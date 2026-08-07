"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  const handleRetry = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="mx-auto max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <WifiOff className="h-10 w-10 text-emerald-500" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            You&apos;re Currently Offline
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Spenza requires an active internet connection to access current balances, group activity, and submit financial changes or settlements.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 text-left text-xs text-muted-foreground shadow-sm">
          <p className="font-semibold text-foreground mb-1">Online-Only Writes Policy</p>
          <p>
            To prevent financial discrepancies and guarantee split accuracy, expenses and settlements cannot be submitted offline. Your data remains safe and synchronized on our servers.
          </p>
        </div>

        <div className="pt-2">
          <Button
            onClick={handleRetry}
            size="lg"
            className="w-full sm:w-auto min-h-[44px] px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Connection
          </Button>
        </div>
      </div>
    </div>
  );
}

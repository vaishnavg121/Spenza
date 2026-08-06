"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          We couldn&apos;t load this screen. Try again or return to your dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <SearchX className="size-6" aria-hidden="true" />
        </div>
        <p className="mt-5 text-sm font-medium text-muted-foreground">404</p>
        <h1 className="mt-1 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page you&apos;re looking for isn&apos;t available.
        </p>
        <Button className="mt-6" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

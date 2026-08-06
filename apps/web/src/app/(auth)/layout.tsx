import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-muted/40 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
      <div className="hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-lg font-bold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15 text-sm">S</span>
          Spenza
        </div>
        <div className="max-w-md">
          <p className="text-4xl font-semibold tracking-tight text-balance">Shared expenses, clearly organized.</p>
          <p className="mt-4 text-base leading-7 text-primary-foreground/75">
            Keep track of groups, balances, and the little details that make sharing easier.
          </p>
        </div>
        <p className="text-sm text-primary-foreground/65">Sign in to continue where you left off.</p>
      </div>
      <div className="flex min-h-dvh items-center justify-center p-4 sm:p-6 lg:p-10">
        {children}
      </div>
    </div>
  );
}

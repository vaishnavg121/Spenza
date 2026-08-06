"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, LayoutDashboard, Users, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: React.ReactNode;
  userName: string;
};

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/groups", label: "Groups", icon: WalletCards },
  { href: "/dashboard/friends", label: "Friends", icon: Users },
  { href: "/dashboard/activity", label: "Activity", icon: Activity },
];

function isCurrentRoute(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children, userName }: AppShellProps) {
  const pathname = usePathname();
  const userInitial = userName.trim().slice(0, 1).toUpperCase() || "S";

  return (
    <div className="min-h-dvh bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-background lg:flex">
        <Link
          href="/dashboard"
          className="flex h-16 items-center gap-3 border-b px-6 text-lg font-bold tracking-tight outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            S
          </span>
          Spenza
        </Link>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1 p-3">
          {navigation.map(({ href, label, icon: Icon }) => {
            const current = isCurrentRoute(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4 text-sm text-muted-foreground">
          Shared expenses, clearly.
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-base font-bold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                S
              </span>
              Spenza
            </Link>
            <div className="hidden min-w-0 lg:block">
              <p className="text-sm text-muted-foreground">Your shared-expense workspace</p>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="hidden max-w-48 truncate text-sm font-medium sm:inline">{userName}</span>
              <span
                aria-label={`${userName} account`}
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground"
              >
                {userInitial}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-8 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Mobile primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {navigation.map(({ href, label, icon: Icon }) => {
            const current = isCurrentRoute(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  current
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="font-bold">
              Spenza
            </Link>
            <nav className="flex gap-4 ml-6">
              <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">
                Dashboard
              </Link>
              <Link href="/dashboard/groups" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Groups
              </Link>
              <Link href="/dashboard/friends" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Friends
              </Link>
              <Link href="/dashboard/activity" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                Activity
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-sm">
                {session.user.name}
             </div>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6">{children}</main>
    </div>
  );
}
import { currentUser } from "@clerk/nextjs/server";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  return (
    <AppShell userName={user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Spenza user"}>{children}</AppShell>
  );
}

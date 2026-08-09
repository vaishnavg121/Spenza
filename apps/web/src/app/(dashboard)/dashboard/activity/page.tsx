"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchActivityApi } from "@/lib/api-activity";
import { formatMinorUnitCurrency } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Activity, Receipt, HandCoins, Users, UserPlus } from "lucide-react";
import type { ActivityItem } from "@spenza/contracts";

export default function ActivityPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["activity"],
    queryFn: () => fetchActivityApi(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Activity" description="Recent actions across all your groups." />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={Activity}
        title="Activity unavailable"
        description="Could not load your activity feed right now."
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        }
      />
    );
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case "EXPENSE_ADDED":
      case "EXPENSE_UPDATED":
      case "EXPENSE_DELETED":
        return <Receipt className="h-4 w-4 text-orange-500" />;
      case "SETTLEMENT_MADE":
      case "SETTLEMENT_REVERSED":
        return <HandCoins className="h-4 w-4 text-emerald-500" />;
      case "GROUP_CREATED":
        return <Users className="h-4 w-4 text-blue-500" />;
      case "USER_JOINED":
        return <UserPlus className="h-4 w-4 text-indigo-500" />;
      default:
        return <Receipt className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityText = (activity: ActivityItem) => {
    const details = activity.details || {};
    switch (activity.action) {
      case "EXPENSE_ADDED": {
        const title = typeof details.title === "string" ? details.title : "Expense";
        const totalMinor = typeof details.totalMinor === "string" ? details.totalMinor : undefined;
        const currency = typeof details.currency === "string" ? details.currency : "USD";
        const amountStr = totalMinor ? formatMinorUnitCurrency(totalMinor, currency) : "";
        return `added expense "${title}"${amountStr ? ` for ${amountStr}` : ""}`;
      }
      case "EXPENSE_UPDATED": {
        const title = typeof details.title === "string" ? details.title : "Expense";
        return `updated expense "${title}"`;
      }
      case "EXPENSE_DELETED": {
        const title = typeof details.title === "string" ? details.title : "Expense";
        return `voided expense "${title}"`;
      }
      case "SETTLEMENT_MADE": {
        const amountMinor = typeof details.amountMinor === "string" ? details.amountMinor : undefined;
        const currency = typeof details.currency === "string" ? details.currency : "USD";
        const amountStr = amountMinor ? formatMinorUnitCurrency(amountMinor, currency) : "";
        return `recorded payment${amountStr ? ` of ${amountStr}` : ""}`;
      }
      case "SETTLEMENT_REVERSED": {
        const amountMinor = typeof details.amountMinor === "string" ? details.amountMinor : undefined;
        const currency = typeof details.currency === "string" ? details.currency : "USD";
        const amountStr = amountMinor ? formatMinorUnitCurrency(amountMinor, currency) : "";
        return `reversed payment${amountStr ? ` of ${amountStr}` : ""}`;
      }
      case "GROUP_CREATED": {
        const name = typeof details.name === "string" ? details.name : (activity.group?.name || "group");
        return `created group "${name}"`;
      }
      case "USER_JOINED":
        return `joined group`;
      default:
        return `performed an action`;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader title="Activity" description="Recent actions across all your groups." />

      {data.data.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Actions in your groups will appear here." />
      ) : (
        <div className="space-y-3">
          {data.data.map((activity) => {
            const userName = activity.user?.name || "Someone";
            const userImage = activity.user?.image || "";
            return (
              <div
                key={activity.id}
                className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={userImage} alt="Avatar" />
                  <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium leading-tight">
                    {userName}{" "}
                    <span className="font-normal text-muted-foreground">{getActivityText(activity)}</span>
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {getActivityIcon(activity.action)}
                    {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    {activity.group?.name && ` in ${activity.group.name}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

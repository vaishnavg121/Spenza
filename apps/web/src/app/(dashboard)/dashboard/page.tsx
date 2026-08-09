"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDashboardApi } from "@/lib/api-dashboard";
import { formatMinorUnitCurrency } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDistanceToNow } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Users, Receipt, HandCoins, UserPlus } from "lucide-react";
import type { ActivityItem } from "@spenza/contracts";

const ZERO_BIGINT = BigInt(0);

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: () => fetchDashboardApi(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6" aria-label="Loading dashboard" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={Receipt}
        title="Dashboard unavailable"
        description="We couldn&apos;t load your dashboard right now. Please try again."
        action={
          <button
            type="button"
            onClick={() => refetch()}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
        return `added an expense "${title}"${amountStr ? ` for ${amountStr}` : ""}`;
      }
      case "EXPENSE_UPDATED": {
        const title = typeof details.title === "string" ? details.title : "Expense";
        return `updated the expense "${title}"`;
      }
      case "SETTLEMENT_MADE": {
        const amountMinor = typeof details.amountMinor === "string" ? details.amountMinor : undefined;
        const currency = typeof details.currency === "string" ? details.currency : "USD";
        const amountStr = amountMinor ? formatMinorUnitCurrency(amountMinor, currency) : "";
        return `recorded a payment${amountStr ? ` of ${amountStr}` : ""}`;
      }
      case "SETTLEMENT_REVERSED": {
        const amountMinor = typeof details.amountMinor === "string" ? details.amountMinor : undefined;
        const currency = typeof details.currency === "string" ? details.currency : "USD";
        const amountStr = amountMinor ? formatMinorUnitCurrency(amountMinor, currency) : "";
        return `reversed a payment${amountStr ? ` of ${amountStr}` : ""}`;
      }
      case "GROUP_CREATED": {
        const name = typeof details.name === "string" ? details.name : (activity.group?.name || "group");
        return `created the group "${name}"`;
      }
      case "USER_JOINED":
        return `joined the group`;
      default:
        return `performed an action`;
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your expenses and balances across all groups."
      />

      {data.currencySummaries.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-6 text-sm text-muted-foreground">No group balances yet.</CardContent>
        </Card>
      ) : (
        data.currencySummaries.map((summary) => {
          const netBalance = BigInt(summary.netBalanceMinor);
          const absoluteNet = netBalance < ZERO_BIGINT ? -netBalance : netBalance;
          return (
            <section key={summary.currency} className="space-y-4" aria-labelledby={`balances-${summary.currency}`}>
              <h2 id={`balances-${summary.currency}`} className="text-lg font-semibold">
                {summary.currency} balances
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total balance</CardTitle></CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${netBalance > ZERO_BIGINT ? "text-emerald-600 dark:text-emerald-400" : netBalance < ZERO_BIGINT ? "text-destructive" : ""}`}>
                      {netBalance > ZERO_BIGINT ? "+" : netBalance < ZERO_BIGINT ? "-" : ""}
                      {formatMinorUnitCurrency(absoluteNet.toString(), summary.currency)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-emerald-500">You are owed</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-3xl">
                      {formatMinorUnitCurrency(summary.totalOwedMinor, summary.currency)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-sm sm:col-span-2 xl:col-span-1">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">You owe</CardTitle></CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold tabular-nums text-destructive sm:text-3xl">
                      {formatMinorUnitCurrency(summary.totalOwingMinor, summary.currency)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>
          );
        })
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {data.currencySummaries.map((summary) => {
          const chartData = summary.spendingChart.map((item) => ({ month: item.month, spending: Number(item.spendingMinor) / 100 }));
          return (
            <Card key={summary.currency} className="min-w-0 shadow-sm">
              <CardHeader>
                <CardTitle>{summary.currency} Spending Overview</CardTitle>
                <CardDescription>Your spending over the last 6 months in {summary.currency}.</CardDescription>
              </CardHeader>
              <CardContent className="min-w-0 px-3 sm:px-5">
                <div className="mt-4 h-64 w-full min-w-0 sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatMinorUnitCurrency(String(Math.round(Number(value) * 100)), summary.currency)} />
                      <Tooltip cursor={{ fill: "rgba(0,0,0,0.1)" }} contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} />
                      <Bar dataKey="spending" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card className="shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in your network.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {data.recentActivities.length === 0 ? (
                <div className="rounded-xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
                  No recent activity yet.
                </div>
              ) : (
                data.recentActivities.map((activity) => {
                  const userName = activity.user?.name || "Someone";
                  const userImage = activity.user?.image || "";
                  return (
                    <div key={activity.id} className="flex items-start gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={userImage} alt="Avatar" />
                        <AvatarFallback>{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-medium leading-5">
                          {userName}{" "}
                          <span className="font-normal text-muted-foreground">
                            {getActivityText(activity)}
                          </span>
                        </p>
                        <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-5 text-muted-foreground">
                          {getActivityIcon(activity.action)}
                          {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                          {activity.group?.name && ` in ${activity.group.name}`}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

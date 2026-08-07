"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchAnalyticsApi } from "@/lib/api-analytics";
import { formatMinorUnitToAmount } from "@/lib/money";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { BarChart3, Wallet, CreditCard, PieChart } from "lucide-react";

export default function AnalyticsPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["analytics"],
    queryFn: () => fetchAnalyticsApi(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics" description="Spending insights and category distribution." />
        <div className="grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Analytics unavailable"
        description="Could not load your spending insights right now."
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

  const monthlyChartData = data.monthlyTrends.map((trend) => ({
    month: trend.month,
    Personal: Number(trend.personalSpendingMinor) / 100,
    GroupTotal: Number(trend.groupTotalMinor) / 100,
  }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Analytics"
        description="Personal spending, category breakdown, and group financial trends."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personal Spending</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
              ${formatMinorUnitToAmount(data.personalSpendingMinor)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Your assigned expense allocations</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contributed</CardTitle>
            <CreditCard className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              ${formatMinorUnitToAmount(data.totalContributedMinor)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Upfront payments made by you</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm sm:col-span-3 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Group Expenses Total</CardTitle>
            <PieChart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
              ${formatMinorUnitToAmount(data.totalGroupExpensesMinor)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Total volume across all your groups</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Monthly Spending Trend</CardTitle>
          <CardDescription>Comparison of your personal share versus group expense volume over the last 6 months.</CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-5">
          <div className="mt-4 h-64 w-full min-w-0 sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData}>
                <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                <Tooltip cursor={{ fill: "rgba(0,0,0,0.1)" }} contentStyle={{ borderRadius: "8px", border: "none" }} />
                <Legend />
                <Bar dataKey="Personal" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="GroupTotal" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Category Distribution</CardTitle>
            <CardDescription>Personal spending grouped by category.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.categoryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No category data available.</p>
            ) : (
              data.categoryBreakdown.map((cat) => (
                <div key={cat.categoryId || "uncategorized"} className="space-y-1">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>{cat.categoryName}</span>
                    <span>${formatMinorUnitToAmount(cat.totalMinor)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(cat.percentageBps / 100).toFixed(1)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Group Breakdown</CardTitle>
            <CardDescription>Your personal share across your active groups.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.groupBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active groups.</p>
            ) : (
              data.groupBreakdown.map((g) => (
                <div key={g.groupId} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium text-sm">{g.groupName}</p>
                    <p className="text-xs text-muted-foreground">
                      Total group volume: ${formatMinorUnitToAmount(g.totalExpensesMinor)}
                    </p>
                  </div>
                  <div className="text-right font-bold text-sm text-foreground">
                    ${formatMinorUnitToAmount(g.personalSpendingMinor)}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

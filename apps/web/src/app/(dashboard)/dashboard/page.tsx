"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/actions/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { formatDistanceToNow } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Users, Receipt, HandCoins, UserPlus } from "lucide-react";

type ActivityDetails = {
  title?: string;
  amount?: number;
  type?: string;
  name?: string;
};

function getActivityDetails(value: unknown): ActivityDetails {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const details = value as Record<string, unknown>;

  return {
    title: typeof details.title === "string" ? details.title : undefined,
    amount: typeof details.amount === "number" ? details.amount : undefined,
    type: typeof details.type === "string" ? details.type : undefined,
    name: typeof details.name === "string" ? details.name : undefined,
  };
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: () => getDashboardData(),
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

  if (isError) {
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
      case "EXPENSE_ADDED": return <Receipt className="h-4 w-4 text-orange-500" />;
      case "SETTLEMENT_MADE": return <HandCoins className="h-4 w-4 text-emerald-500" />;
      case "GROUP_CREATED": return <Users className="h-4 w-4 text-blue-500" />;
      case "USER_JOINED": return <UserPlus className="h-4 w-4 text-indigo-500" />;
      default: return <Receipt className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActivityText = (activity: { action: string; details: unknown }) => {
    const details = getActivityDetails(activity.details);
    switch (activity.action) {
      case "EXPENSE_ADDED":
        return `added an expense "${details?.title}" for $${details?.amount?.toFixed(2)}`;
      case "SETTLEMENT_MADE":
        return `recorded a payment of $${details?.amount?.toFixed(2)}`;
      case "GROUP_CREATED":
        if (details?.type === "FRIEND_REQUEST") return `sent a friend request`;
        return `created the group "${details?.name}"`;
      default:
        return `performed an action`;
    }
  };

  const balances = data?.balances ?? {
    totalBalance: 0,
    youAreOwed: 0,
    youOwe: 0,
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of your expenses and balances across all groups."
      />
      
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tabular-nums sm:text-3xl ${balances.totalBalance > 0 ? "text-emerald-600 dark:text-emerald-400" : balances.totalBalance < 0 ? "text-destructive" : ""}`}>
              {balances.totalBalance > 0 ? "+" : ""}
              ${balances.totalBalance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-500">You are owed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 sm:text-3xl">
              ${balances.youAreOwed.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-sm sm:col-span-2 xl:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">You owe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-destructive sm:text-3xl">
              ${balances.youOwe.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-5">
        <Card className="min-w-0 shadow-sm xl:col-span-3">
          <CardHeader>
            <CardTitle>Spending Overview</CardTitle>
            <CardDescription>Your total spending over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-3 sm:px-5">
            <div className="mt-4 h-64 w-full min-w-0 sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.chartData}>
                  <XAxis 
                    dataKey="month" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                  />
                  <Tooltip 
                     cursor={{ fill: 'rgba(0,0,0,0.1)' }}
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="spending" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm xl:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in your network.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              {data?.activities?.length === 0 ? (
                 <div className="rounded-xl bg-muted/60 px-4 py-8 text-center text-sm text-muted-foreground">
                    No recent activity yet.
                 </div>
              ) : (
                data?.activities?.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={activity.user.image || ""} alt="Avatar" />
                      <AvatarFallback>{activity.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-5">
                        {activity.user.name} <span className="font-normal text-muted-foreground">{getActivityText(activity)}</span>
                      </p>
                      <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-xs leading-5 text-muted-foreground">
                        {getActivityIcon(activity.action)}
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                        {activity.group?.name && ` in ${activity.group.name}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

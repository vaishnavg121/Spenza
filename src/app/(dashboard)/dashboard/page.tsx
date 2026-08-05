"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardData } from "@/actions/dashboard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { Users, Receipt, HandCoins, UserPlus } from "lucide-react";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: () => getDashboardData(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
      </div>
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

  const getActivityText = (activity: any) => {
    const details = activity.details as any;
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your expenses and balances across all groups.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data?.balances.totalBalance! > 0 ? "text-emerald-500" : data?.balances.totalBalance! < 0 ? "text-destructive" : ""}`}>
              {data?.balances.totalBalance! > 0 ? "+" : ""}
              ${data?.balances.totalBalance!.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-500">You are owed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              ${data?.balances.youAreOwed.toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">You owe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${data?.balances.youOwe.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Spending Overview</CardTitle>
            <CardDescription>Your total spending over the last 6 months.</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full mt-4">
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

        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions in your network.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {data?.activities.length === 0 ? (
                 <div className="text-sm text-muted-foreground text-center py-8">
                    No recent activity
                 </div>
              ) : (
                data?.activities.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={activity.user.image || ""} alt="Avatar" />
                      <AvatarFallback>{activity.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium leading-none">
                        {activity.user.name} <span className="font-normal text-muted-foreground">{getActivityText(activity)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
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
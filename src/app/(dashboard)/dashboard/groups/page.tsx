"use client";

import { useQuery } from "@tanstack/react-query";
import { getGroups } from "@/actions/groups";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import Link from "next/link";

export default function GroupsPage() {
  const { data: groups, isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: () => getGroups(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Groups</h2>
          <p className="text-muted-foreground">
            Manage your shared expenses and cohorts.
          </p>
        </div>
        <CreateGroupDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-[150px]" />
                  <Skeleton className="h-4 w-[100px]" />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : groups?.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 p-8 text-center animate-in fade-in-50">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No groups found</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-sm">
            You are not part of any groups yet. Create a group to start splitting expenses with friends.
          </p>
          <CreateGroupDialog />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups?.map((group) => (
            <Link key={group.id} href={`/dashboard/groups/${group.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0">
                  <Avatar className="h-12 w-12 rounded-lg">
                    {group.imageUrl ? (
                      <AvatarImage src={group.imageUrl} alt={group.name} />
                    ) : (
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                        {group.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <CardTitle className="text-base line-clamp-1">{group.name}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {group.description || `${group.members.length} members`}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 3).map((m) => (
                        <Avatar key={m.id} className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={m.user.image || undefined} />
                          <AvatarFallback className="text-[10px]">
                            {m.user.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {group.members.length > 3 && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-medium">
                          +{group.members.length - 3}
                        </div>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs font-medium">
                      {group._count.expenses} expenses
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
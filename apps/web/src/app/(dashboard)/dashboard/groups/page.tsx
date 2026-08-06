"use client";

import { useQuery } from "@tanstack/react-query";
import { getGroups } from "@/actions/groups";
import { CreateGroupDialog } from "@/components/groups/create-group-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Users } from "lucide-react";
import Link from "next/link";

export default function GroupsPage() {
  const { data: groups, isLoading, isError, refetch } = useQuery({
    queryKey: ["groups"],
    queryFn: () => getGroups(),
  });

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Groups"
        description="Manage your shared expenses and the people you share them with."
        action={<CreateGroupDialog />}
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Loading groups" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-sm">
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
      ) : isError ? (
        <EmptyState
          icon={Users}
          title="Groups unavailable"
          description="We couldn&apos;t load your groups right now."
          action={<button type="button" onClick={() => refetch()} className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Try again</button>}
        />
      ) : groups?.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups found"
          description="Create a group to start splitting expenses with friends."
          action={<CreateGroupDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups?.map((group) => (
            <Link key={group.id} href={`/dashboard/groups/${group.id}`} className="group block h-full rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Card className="h-full shadow-sm transition-colors group-hover:border-primary/50">
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
                  <div className="flex items-center justify-between gap-3 text-sm">
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

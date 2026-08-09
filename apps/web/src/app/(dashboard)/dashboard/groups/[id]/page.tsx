"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupById } from "@/lib/api-groups";
import { fetchProfileApi } from "@/lib/api-profile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { AddMemberDialog } from "@/components/groups/add-member-dialog";
import { ShareGroupDialog } from "@/components/groups/share-group-dialog";
import { BalancesList } from "@/components/groups/group-balances";
import { GroupExpenseList } from "@/components/expenses/group-expense-list";
import { GroupSettings } from "@/components/groups/group-settings";
import { SettlementHistory } from "@/components/settlements/settlement-history";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export default function GroupDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = use(params);

  const {
    data: group,
    isLoading: isGroupLoading,
    isError: isGroupError,
    refetch: refetchGroup,
  } = useQuery({
    queryKey: ["group-details", groupId],
    queryFn: () => fetchGroupById(groupId),
    enabled: Boolean(groupId),
  });

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfileApi(),
  });

  const currentUserId = profile?.id ?? "";

  if (isGroupLoading || isProfileLoading) {
    return (
      <div className="space-y-6 sm:space-y-8" aria-label="Loading group details" aria-busy="true">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-16 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (isGroupError || isProfileError || !group || !profile) {
    return (
      <EmptyState
        icon={Users}
        title="Group unavailable"
        description="We couldn't load this group or you may not have access."
        action={
          <button
            type="button"
            onClick={() => {
              void refetchGroup();
              void refetchProfile();
            }}
            className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        }
      />
    );
  }

  const formattedMembers = group.members.map((m) => ({
    id: m.userId,
    name: m.user.name,
    image: m.user.image ?? null,
  }));
  const isCurrentUserAdmin = group.members.some(
    (member) => member.userId === currentUserId && member.role === "ADMIN",
  );

  const membersForComponents = group.members.map((m) => ({
    ...m,
    user: {
      ...m.user,
      image: m.user.image ?? null,
    },
  }));

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Avatar className="size-14 shrink-0 rounded-2xl border sm:size-16">
            {group.imageUrl ? (
              <AvatarImage src={group.imageUrl} alt={group.name} />
            ) : (
              <AvatarFallback className="rounded-xl bg-primary/10 text-xl text-primary">
                {group.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{group.name}</h1>
              {group.currency && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {group.currency}
                </Badge>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground sm:text-base">
              {group.description || "No description provided"}
            </p>
          </div>
        </div>
        <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          {isCurrentUserAdmin ? (
            <>
              <AddMemberDialog
                groupId={group.id}
                existingMemberIds={group.members.map((member) => member.userId)}
              />
              <ShareGroupDialog groupId={group.id} groupName={group.name} />
            </>
          ) : null}
          <AddExpenseDialog
            groupId={group.id}
            members={formattedMembers}
            currentUserId={currentUserId}
            currency={group.currency}
          />
        </div>
      </div>

      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto rounded-none border-b bg-transparent p-0">
          <TabsTrigger
            value="expenses"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Expenses
          </TabsTrigger>
          <TabsTrigger
            value="balances"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Balances
          </TabsTrigger>
          <TabsTrigger
            value="settlements"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            History
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Members ({group.members.length})
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="pt-5 sm:pt-6">
          <GroupExpenseList groupId={group.id} currentUserId={currentUserId} currency={group.currency} members={group.members} />
        </TabsContent>
        <TabsContent value="balances" className="pt-5 sm:pt-6">
          <BalancesList groupId={group.id} members={membersForComponents} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="settlements" className="pt-5 sm:pt-6">
          <SettlementHistory groupId={group.id} members={membersForComponents} currentUserId={currentUserId} />
        </TabsContent>
        <TabsContent value="members" className="space-y-4 pt-5 sm:pt-6">
          {group.members.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Avatar>
                  <AvatarImage src={member.user.image || ""} />
                  <AvatarFallback>{member.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium leading-none">
                    {member.user.name} {member.userId === currentUserId && "(You)"}
                  </p>
                  <p className="truncate pt-1 text-sm text-muted-foreground">{member.user.email}</p>
                </div>
              </div>
              <div className="text-sm font-medium text-muted-foreground sm:text-right">
                <Badge variant={member.role === "ADMIN" ? "default" : "outline"}>
                  {member.role}
                </Badge>
              </div>
            </div>
          ))}
        </TabsContent>
        <TabsContent value="settings" className="pt-5 sm:pt-6">
          <GroupSettings group={group} currentUserId={currentUserId} isAdmin={isCurrentUserAdmin} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

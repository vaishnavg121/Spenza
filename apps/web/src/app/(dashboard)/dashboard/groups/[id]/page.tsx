import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { BalancesList } from "@/components/groups/group-balances";
import { GroupExpenseList } from "@/components/expenses/group-expense-list";
import { SettlementHistory } from "@/components/settlements/settlement-history";

export default async function GroupDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const group = await prisma.group.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: true,
        },
      },
      settlements: true,
      expenses: {
        include: {
          creator: true,
          splits: true,
        },
        orderBy: {
          date: "desc",
        },
      },
    },
  });

  if (!group) {
    notFound();
  }

  const isMember = group.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    notFound();
  }

  const formattedMembers = group.members.map(m => ({
     id: m.userId,
     name: m.user.name,
     image: m.user.image,
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
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{group.name}</h1>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground sm:text-base">{group.description || "No description provided"}</p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <AddExpenseDialog
             groupId={group.id}
             members={formattedMembers}
             currentUserId={session.user.id}
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
            Members
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="pt-5 sm:pt-6">
          <GroupExpenseList groupId={group.id} currentUserId={session.user.id} />
        </TabsContent>
        <TabsContent value="balances" className="pt-5 sm:pt-6">
           <BalancesList 
              groupId={group.id} 
              members={group.members} 
              currentUserId={session.user.id}
           />
        </TabsContent>
        <TabsContent value="settlements" className="pt-5 sm:pt-6">
           <SettlementHistory
              groupId={group.id}
              members={group.members}
              currentUserId={session.user.id}
           />
        </TabsContent>
        <TabsContent value="members" className="space-y-4 pt-5 sm:pt-6">
           {group.members.map(member => (
              <div key={member.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
                 <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                    <Avatar>
                       <AvatarImage src={member.user.image || ""} />
                       <AvatarFallback>{member.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                       <p className="truncate font-medium leading-none">{member.user.name} {member.userId === session.user.id && "(You)"}</p>
                       <p className="truncate pt-1 text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                 </div>
                 <div className="text-sm font-medium text-muted-foreground sm:text-right">
                    {member.role}
                 </div>
              </div>
           ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

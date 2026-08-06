import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { BalancesList } from "@/components/groups/group-balances";
import { EmptyState } from "@/components/ui/empty-state";
import { format } from "date-fns";
import { ReceiptText } from "lucide-react";

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
            value="members"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
          >
            Members
          </TabsTrigger>
        </TabsList>
        <TabsContent value="expenses" className="pt-5 sm:pt-6">
          {group.expenses.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No expenses yet"
              description="Add your first expense to start tracking splits."
              action={
                <AddExpenseDialog
                  groupId={group.id}
                  members={formattedMembers}
                  currentUserId={session.user.id}
                />
              }
            />
          ) : (
            <div className="space-y-4">
               {group.expenses.map((expense) => {
                  const youPaid = expense.splits.find(s => s.userId === session.user.id)?.amountPaid || 0;
                  const youOwe = expense.splits.find(s => s.userId === session.user.id)?.amountOwed || 0;
                  
                  let status = "Not involved";
                  let statusColor = "text-muted-foreground";
                  let statusAmount = "";

                  if (youPaid > 0 && youOwe > 0) {
                      const net = youPaid - youOwe;
                      if (net > 0) {
                         status = "You lent";
                         statusColor = "text-emerald-500";
                         statusAmount = `$${net.toFixed(2)}`;
                      } else if (net < 0) {
                         status = "You owe";
                         statusColor = "text-destructive";
                         statusAmount = `$${Math.abs(net).toFixed(2)}`;
                      } else {
                         status = "Settled up";
                         statusColor = "text-muted-foreground";
                      }
                  } else if (youPaid > 0) {
                      status = "You lent";
                      statusColor = "text-emerald-500";
                      statusAmount = `$${(youPaid - youOwe).toFixed(2)}`;
                  } else if (youOwe > 0) {
                      status = "You owe";
                      statusColor = "text-destructive";
                      statusAmount = `$${youOwe.toFixed(2)}`;
                  }

                  return (
                    <div key={expense.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                       <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center leading-tight">
                             <span className="text-xs text-muted-foreground font-medium uppercase">{format(expense.date, 'MMM')}</span>
                             <span className="text-lg font-bold">{format(expense.date, 'dd')}</span>
                          </div>
                          <div className="min-w-0">
                             <p className="truncate font-medium">{expense.title}</p>
                             <p className="truncate text-sm text-muted-foreground">
                                {expense.creator.name} paid <span className="font-medium text-foreground">${expense.amount.toFixed(2)}</span>
                             </p>
                          </div>
                       </div>
                       <div className="flex items-center justify-between gap-3 border-t pt-3 text-left sm:block sm:border-0 sm:pt-0 sm:text-right">
                          <p className={`text-xs font-medium ${statusColor}`}>{status}</p>
                          {statusAmount && <p className={`font-bold tabular-nums ${statusColor}`}>{statusAmount}</p>}
                       </div>
                    </div>
                  );
               })}
            </div>
          )}
        </TabsContent>
        <TabsContent value="balances" className="pt-5 sm:pt-6">
           <BalancesList 
              groupId={group.id} 
              members={group.members} 
              expenses={group.expenses} 
              settlements={group.settlements} 
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

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchBalancesApi } from "@/lib/api-balances";
import { SettleUpDialog } from "@/components/settlements/settle-up-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatMinorUnitCurrency } from "@/lib/money";

type GroupMember = {
  userId: string;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
};

interface BalancesListProps {
  groupId: string;
  members: GroupMember[];
  currentUserId: string;
}

export function BalancesList({ groupId, members, currentUserId }: BalancesListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["balances", groupId],
    queryFn: () => fetchBalancesApi(groupId),
  });

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading balances...</div>;
  }

  if (error || !data) {
    return <div className="py-8 text-center text-destructive">Failed to load balances.</div>;
  }

  const getMember = (id: string) => members.find(m => m.userId === id)?.user;

  if (data.suggestions.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">All Settled Up!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No one owes anything in this group.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Suggested Settlements</h3>
        <p className="mt-1 text-sm text-muted-foreground">A clear path to settling the current group balances.</p>
      </div>
      {data.suggestions.map((debt, index) => {
        const debtor = getMember(debt.senderId);
        const creditor = getMember(debt.receiverId);

        if (!debtor || !creditor) return null;

        const isCurrentUserDebtor = currentUserId === debtor.id;
        const isCurrentUserCreditor = currentUserId === creditor.id;

        return (
          <div key={index} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
               <div className="flex -space-x-2">
                  <Avatar className="h-8 w-8 border-2 border-background">
                     <AvatarImage src={debtor.image || ""} />
                     <AvatarFallback>{debtor.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Avatar className="h-8 w-8 border-2 border-background">
                     <AvatarImage src={creditor.image || ""} />
                     <AvatarFallback>{creditor.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
               </div>
               <div className="min-w-0">
                  <p className="text-sm font-medium leading-5">
                     <span className={isCurrentUserDebtor ? "font-bold" : ""}>
                        {isCurrentUserDebtor ? "You" : debtor.name}
                     </span>
                     <span className="text-muted-foreground mx-1">owe</span>
                     <span className={isCurrentUserCreditor ? "font-bold" : ""}>
                        {isCurrentUserCreditor ? "You" : creditor.name}
                     </span>
                  </p>
                  <p className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatMinorUnitCurrency(debt.amountMinor, data.currency)}</p>
               </div>
            </div>
            
            <SettleUpDialog 
               groupId={groupId}
               creditorId={creditor.id}
               debtorName={isCurrentUserDebtor ? "You" : debtor.name}
               creditorName={isCurrentUserCreditor ? "You" : creditor.name}
               amountMinor={debt.amountMinor}
               currency={data.currency}
               isCurrentUserDebtor={isCurrentUserDebtor}
               isCurrentUserCreditor={isCurrentUserCreditor}
            />
          </div>
        );
      })}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchExpensesApi } from "@/lib/api-expenses";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptText } from "lucide-react";
import { format } from "date-fns";
import { formatMinorUnitToAmount } from "@/lib/money";
import { ReceiptManager } from "@/components/receipts/receipt-manager";

interface GroupExpenseListProps {
  groupId: string;
  currentUserId: string;
}

export function GroupExpenseList({ groupId, currentUserId }: GroupExpenseListProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses", groupId],
    queryFn: () => fetchExpensesApi(groupId),
  });

  if (isLoading) {
    return <div className="py-8 text-center text-muted-foreground">Loading expenses...</div>;
  }

  if (error) {
    return <div className="py-8 text-center text-destructive">Failed to load expenses.</div>;
  }

  const expenses = data?.data || [];

  if (expenses.length === 0) {
    return (
      <EmptyState
        icon={ReceiptText}
        title="No expenses yet"
        description="Add your first expense to start tracking splits."
        // We'll let the parent handle the action or AddExpenseDialog since it needs members
      />
    );
  }

  return (
    <div className="space-y-4">
      {expenses.map((expense) => {
        const youPaidStr = expense.payers.find(p => p.userId === currentUserId)?.contributionMinor || "0";
        const youOweStr = expense.allocations.find(a => a.userId === currentUserId)?.allocationMinor || "0";

        const youPaid = Number(youPaidStr);
        const youOwe = Number(youOweStr);

        let status = "Not involved";
        let statusColor = "text-muted-foreground";
        let statusAmount = "";

        if (youPaid > 0 && youOwe > 0) {
            const net = youPaid - youOwe;
            if (net > 0) {
               status = "You lent";
               statusColor = "text-emerald-500";
               statusAmount = `$${formatMinorUnitToAmount(net.toString())}`;
            } else if (net < 0) {
               status = "You owe";
               statusColor = "text-destructive";
               statusAmount = `$${formatMinorUnitToAmount(Math.abs(net).toString())}`;
            } else {
               status = "Settled up";
               statusColor = "text-muted-foreground";
            }
        } else if (youPaid > 0) {
            status = "You lent";
            statusColor = "text-emerald-500";
            statusAmount = `$${formatMinorUnitToAmount((youPaid - youOwe).toString())}`;
        } else if (youOwe > 0) {
            status = "You owe";
            statusColor = "text-destructive";
            statusAmount = `$${formatMinorUnitToAmount(youOwe.toString())}`;
        }

        return (
          <div key={expense.id} className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:p-5">
             <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-xl bg-muted text-center leading-tight">
                   <span className="text-xs text-muted-foreground font-medium uppercase">{format(new Date(expense.date), 'MMM')}</span>
                   <span className="text-lg font-bold">{format(new Date(expense.date), 'dd')}</span>
                </div>
                 <div className="min-w-0">
                   <p className="truncate font-medium">{expense.title}</p>
                   <p className="truncate text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">${formatMinorUnitToAmount(expense.totalMinor)}</span>
                   </p>
                   <ReceiptManager groupId={groupId} expenseId={expense.id} />
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
  );
}

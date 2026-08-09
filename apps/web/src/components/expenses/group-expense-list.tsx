"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchExpensesApi } from "@/lib/api-expenses";
import { EmptyState } from "@/components/ui/empty-state";
import { ReceiptText } from "lucide-react";
import type { GroupMemberResponse } from "@spenza/contracts";
import { ExpenseDetailDialog } from "@/components/expenses/expense-detail-dialog";

interface GroupExpenseListProps {
  groupId: string;
  currentUserId: string;
  currency: string;
  members: GroupMemberResponse[];
}

export function GroupExpenseList({ groupId, currentUserId, members }: GroupExpenseListProps) {
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
      {expenses.map((expense) => <ExpenseDetailDialog key={expense.id} expense={expense} groupId={groupId} currentUserId={currentUserId} members={members.map((member) => ({ id: member.userId, name: member.user.name, image: member.user.image ?? null }))} />)}
    </div>
  );
}

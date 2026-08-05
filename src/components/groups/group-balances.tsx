import { SettleUpDialog } from "@/components/settlements/settle-up-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type GroupMember = {
  userId: string;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
};

type ExpenseSplit = {
  userId: string;
  amountPaid: number;
  amountOwed: number;
};

type Expense = {
  splits: ExpenseSplit[];
};

type Settlement = {
  payerId: string;
  payeeId: string;
  amount: number;
  status: string;
};

interface BalancesListProps {
  groupId: string;
  members: GroupMember[];
  expenses: Expense[];
  settlements: Settlement[];
  currentUserId: string;
}

export function BalancesList({ groupId, members, expenses, settlements, currentUserId }: BalancesListProps) {
  // 1. Calculate net balances
  const balances = new Map<string, number>();
  
  // Initialize balances to 0
  members.forEach((m) => balances.set(m.userId, 0));

  // Add expenses
  expenses.forEach((expense) => {
    expense.splits.forEach((split) => {
      const current = balances.get(split.userId) || 0;
      balances.set(split.userId, current + (split.amountPaid - split.amountOwed));
    });
  });

  // Add settlements
  settlements.forEach((settlement) => {
    if (settlement.status !== "COMPLETED") return;
    const payerBalance = balances.get(settlement.payerId) || 0;
    const payeeBalance = balances.get(settlement.payeeId) || 0;
    
    // Payer's net goes up, Payee's net goes down
    balances.set(settlement.payerId, payerBalance + settlement.amount);
    balances.set(settlement.payeeId, payeeBalance - settlement.amount);
  });

  // 2. Simplify debts using greedy algorithm
  const debtors: { userId: string; amount: number }[] = [];
  const creditors: { userId: string; amount: number }[] = [];

  balances.forEach((balance, userId) => {
    // Handling minor floating point inaccuracies
    if (balance < -0.01) debtors.push({ userId, amount: -balance });
    else if (balance > 0.01) creditors.push({ userId, amount: balance });
  });

  // Sort descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  type Debt = { debtorId: string; creditorId: string; amount: number };
  const simplifiedDebts: Debt[] = [];

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];
    
    const amount = Math.min(debtor.amount, creditor.amount);

    simplifiedDebts.push({
      debtorId: debtor.userId,
      creditorId: creditor.userId,
      amount: Math.round(amount * 100) / 100,
    });

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  const getMember = (id: string) => members.find(m => m.userId === id)?.user;

  if (simplifiedDebts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border rounded-xl bg-card">
        <h3 className="text-lg font-semibold text-emerald-500">All Settled Up!</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No one owes anything in this group.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Suggested Settlements</h3>
      {simplifiedDebts.map((debt, index) => {
        const debtor = getMember(debt.debtorId);
        const creditor = getMember(debt.creditorId);

        if (!debtor || !creditor) return null;

        const isCurrentUserDebtor = currentUserId === debtor.id;
        const isCurrentUserCreditor = currentUserId === creditor.id;

        return (
          <div key={index} className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-4">
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
               <div>
                  <p className="font-medium text-sm">
                     <span className={isCurrentUserDebtor ? "font-bold" : ""}>
                        {isCurrentUserDebtor ? "You" : debtor.name}
                     </span>
                     <span className="text-muted-foreground mx-1">owe</span>
                     <span className={isCurrentUserCreditor ? "font-bold" : ""}>
                        {isCurrentUserCreditor ? "You" : creditor.name}
                     </span>
                  </p>
                  <p className="text-emerald-500 font-bold">${debt.amount.toFixed(2)}</p>
               </div>
            </div>
            
            <SettleUpDialog 
               groupId={groupId}
               debtorId={debtor.id}
               creditorId={creditor.id}
               debtorName={isCurrentUserDebtor ? "You" : debtor.name}
               creditorName={isCurrentUserCreditor ? "You" : creditor.name}
               amount={debt.amount}
               isCurrentUserDebtor={isCurrentUserDebtor}
               isCurrentUserCreditor={isCurrentUserCreditor}
            />
          </div>
        );
      })}
    </div>
  );
}
export type LedgerExpense = {
  currency: string;
  totalMinor: bigint;
  payments: Array<{ userId: string; contributionMinor: bigint }>;
  allocations: Array<{ userId: string; allocationMinor: bigint }>;
};

export type LedgerSettlement = {
  currency: string;
  payerId: string;
  receiverId: string;
  amountMinor: bigint;
  kind: "PAYMENT" | "REVERSAL";
};

export type SuggestedTransfer = { senderId: string; receiverId: string; amountMinor: bigint };

export class BalanceInvariantError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

function add(balances: Map<string, bigint>, userId: string, amount: bigint): void {
  balances.set(userId, (balances.get(userId) ?? 0n) + amount);
}

export function deriveBalances(
  currency: string,
  knownUserIds: Iterable<string>,
  expenses: LedgerExpense[],
  settlements: LedgerSettlement[],
): Map<string, bigint> {
  const balances = new Map<string, bigint>();
  for (const userId of knownUserIds) {
    if (!userId || balances.has(userId)) {
      throw new BalanceInvariantError("INVALID_MEMBER_SET", "Balance member IDs must be non-empty and distinct");
    }
    balances.set(userId, 0n);
  }

  for (const expense of expenses) {
    if (expense.currency !== currency) {
      throw new BalanceInvariantError("INCOMPATIBLE_CURRENCY", "Expense currency does not match the group currency");
    }
    if (expense.totalMinor <= 0n || expense.payments.length === 0 || expense.allocations.length === 0) {
      throw new BalanceInvariantError("INVALID_EXPENSE_LEDGER", "Expense ledger data is incomplete");
    }
    const contributionTotal = expense.payments.reduce((sum, payment) => {
      if (payment.contributionMinor <= 0n) {
        throw new BalanceInvariantError("INVALID_EXPENSE_LEDGER", "Expense contribution must be positive");
      }
      add(balances, payment.userId, payment.contributionMinor);
      return sum + payment.contributionMinor;
    }, 0n);
    const allocationTotal = expense.allocations.reduce((sum, allocation) => {
      if (allocation.allocationMinor < 0n) {
        throw new BalanceInvariantError("INVALID_EXPENSE_LEDGER", "Expense allocation cannot be negative");
      }
      add(balances, allocation.userId, -allocation.allocationMinor);
      return sum + allocation.allocationMinor;
    }, 0n);
    if (contributionTotal !== expense.totalMinor || allocationTotal !== expense.totalMinor) {
      throw new BalanceInvariantError("EXPENSE_NOT_RECONCILED", "Expense ledger does not reconcile to its total");
    }
  }

  for (const settlement of settlements) {
    if (settlement.currency !== currency) {
      throw new BalanceInvariantError("INCOMPATIBLE_CURRENCY", "Settlement currency does not match the group currency");
    }
    if (settlement.amountMinor <= 0n || settlement.payerId === settlement.receiverId) {
      throw new BalanceInvariantError("INVALID_SETTLEMENT_LEDGER", "Settlement ledger data is invalid");
    }
    const direction = settlement.kind === "PAYMENT" ? 1n : -1n;
    add(balances, settlement.payerId, direction * settlement.amountMinor);
    add(balances, settlement.receiverId, -direction * settlement.amountMinor);
  }

  const total = [...balances.values()].reduce((sum, balance) => sum + balance, 0n);
  if (total !== 0n) {
    throw new BalanceInvariantError("BALANCE_NOT_ZERO_SUM", "Group balances are not zero-sum");
  }
  return balances;
}

export function simplifyBalances(balances: ReadonlyMap<string, bigint>): SuggestedTransfer[] {
  const total = [...balances.values()].reduce((sum, balance) => sum + balance, 0n);
  if (total !== 0n) {
    throw new BalanceInvariantError("BALANCE_NOT_ZERO_SUM", "Cannot simplify non-zero-sum balances");
  }
  const debtors = [...balances.entries()]
    .filter(([, balance]) => balance < 0n)
    .map(([userId, balance]) => ({ userId, remaining: -balance }))
    .sort((left, right) => left.userId.localeCompare(right.userId));
  const creditors = [...balances.entries()]
    .filter(([, balance]) => balance > 0n)
    .map(([userId, balance]) => ({ userId, remaining: balance }))
    .sort((left, right) => left.userId.localeCompare(right.userId));

  const transfers: SuggestedTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = debtor.remaining < creditor.remaining ? debtor.remaining : creditor.remaining;
    transfers.push({ senderId: debtor.userId, receiverId: creditor.userId, amountMinor });
    debtor.remaining -= amountMinor;
    creditor.remaining -= amountMinor;
    if (debtor.remaining === 0n) debtorIndex += 1;
    if (creditor.remaining === 0n) creditorIndex += 1;
  }
  return transfers;
}

import { PrismaClient, Prisma } from "@prisma/client";
import { ExpenseRecord } from "../expenses/expense-repository.js";
import { SettlementRecord } from "../settlements/settlement-repository.js";
import { LedgerExpense, LedgerSettlement } from "../settlements/balance-engine.js";
import { ActivityRecord } from "../activity/activity-repository.js";

export type DashboardGroup = {
  id: string;
  name: string;
  currency: string;
};

export type DashboardGroupLedger = {
  groupId: string;
  currency: string;
  knownUserIds: Set<string>;
  expenses: LedgerExpense[];
  settlements: LedgerSettlement[];
};

export type MonthlySpending = {
  month: string;
  spendingMinor: bigint;
};

export interface DashboardRepository {
  findUserGroups(userId: string): Promise<DashboardGroup[]>;
  loadGroupLedgers(groupIds: string[]): Promise<DashboardGroupLedger[]>;
  findRecentExpenses(groupIds: string[], limit: number): Promise<ExpenseRecord[]>;
  findRecentSettlements(groupIds: string[], limit: number): Promise<SettlementRecord[]>;
  findRecentActivities(userId: string, groupIds: string[], limit: number): Promise<ActivityRecord[]>;
  findMonthlySpending(userId: string, groupIds: string[]): Promise<MonthlySpending[]>;
}

export class PrismaDashboardRepository implements DashboardRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserGroups(userId: string): Promise<DashboardGroup[]> {
    const members = await this.prisma.groupMember.findMany({
      where: { userId },
      select: {
        group: {
          select: { id: true, name: true, currency: true },
        },
      },
    });
    return members.map((m) => m.group);
  }

  async loadGroupLedgers(groupIds: string[]): Promise<DashboardGroupLedger[]> {
    if (groupIds.length === 0) return [];

    const groups = await this.prisma.group.findMany({
      where: { id: { in: groupIds } },
      include: {
        members: { select: { userId: true } },
        expenses: {
          where: { voidedAt: null },
          include: {
            payments: { select: { userId: true, contributionMinor: true } },
            splits: { select: { userId: true, allocationMinor: true, amountOwed: true } },
          },
        },
        settlements: {
          where: { status: "COMPLETED" },
          select: {
            payerId: true,
            payeeId: true,
            amount: true,
            amountMinor: true,
            currency: true,
            kind: true,
          },
        },
      },
    });

    return groups.map((group) => {
      const knownUserIds = new Set(group.members.map((m) => m.userId));

      const ledgerExpenses: LedgerExpense[] = group.expenses.map((expense) => {
        const totalMinor = expense.totalMinor ?? BigInt(Math.round(expense.amount * 100));
        const payments = expense.payments.length > 0
          ? expense.payments.map((p) => ({ userId: p.userId, contributionMinor: p.contributionMinor }))
          : [{ userId: expense.creatorId, contributionMinor: totalMinor }];
        const allocations = expense.splits.map((s) => ({
          userId: s.userId,
          allocationMinor: s.allocationMinor ?? BigInt(Math.round(s.amountOwed * 100)),
        }));
        return {
          currency: expense.currency,
          totalMinor,
          payments,
          allocations,
        };
      });

      const ledgerSettlements: LedgerSettlement[] = group.settlements.map((s) => ({
        currency: s.currency,
        payerId: s.payerId,
        receiverId: s.payeeId,
        amountMinor: s.amountMinor ?? BigInt(Math.round(s.amount * 100)),
        kind: s.kind,
      }));

      return {
        groupId: group.id,
        currency: group.currency,
        knownUserIds,
        expenses: ledgerExpenses,
        settlements: ledgerSettlements,
      };
    });
  }

  async findRecentExpenses(groupIds: string[], limit: number): Promise<ExpenseRecord[]> {
    if (groupIds.length === 0) return [];

    const records = await this.prisma.expense.findMany({
      where: {
        groupId: { in: groupIds },
        voidedAt: null,
      },
      include: {
        payments: { select: { userId: true, contributionMinor: true, paymentOrder: true } },
        splits: { select: { userId: true, allocationMinor: true, allocationOrder: true, percentageBps: true, shareWeight: true, amountOwed: true } },
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return records.map((record) => {
      const totalMinor = record.totalMinor ?? BigInt(Math.round(record.amount * 100));
      const payments = record.payments.length > 0
        ? record.payments.map((p) => ({ userId: p.userId, contributionMinor: p.contributionMinor, order: p.paymentOrder }))
        : [{ userId: record.creatorId, contributionMinor: totalMinor, order: 0 }];
      const allocations = record.splits.map((s) => ({
        userId: s.userId,
        allocationMinor: s.allocationMinor ?? BigInt(Math.round(s.amountOwed * 100)),
        order: s.allocationOrder ?? 0,
        percentageBps: s.percentageBps ?? null,
        shareWeight: s.shareWeight ?? null,
      }));

      return {
        id: record.id,
        groupId: record.groupId!,
        creatorId: record.creatorId,
        title: record.title,
        description: record.description,
        categoryId: record.categoryId,
        totalMinor,
        currency: record.currency,
        splitType: record.splitType as ExpenseRecord["splitType"],
        version: record.version,
        date: record.date,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        payments,
        allocations,
      };
    });
  }

  async findRecentSettlements(groupIds: string[], limit: number): Promise<SettlementRecord[]> {
    if (groupIds.length === 0) return [];

    const records = await this.prisma.settlement.findMany({
      where: {
        groupId: { in: groupIds },
        status: "COMPLETED",
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return records.map((record) => ({
      id: record.id,
      groupId: record.groupId!,
      payerId: record.payerId,
      receiverId: record.payeeId,
      amountMinor: record.amountMinor ?? BigInt(Math.round(record.amount * 100)),
      currency: record.currency,
      method: record.method,
      kind: record.kind,
      status: record.status,
      reversesId: record.reversesId,
      createdById: record.createdById,
      date: record.date,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async findRecentActivities(userId: string, groupIds: string[], limit: number): Promise<ActivityRecord[]> {
    const whereClause: Prisma.ActivityWhereInput = {
      OR: [
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
        { userId, groupId: null },
      ],
    };

    const records = await this.prisma.activity.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, image: true } },
        group: { select: { id: true, name: true } },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: limit,
    });

    return records.map((record) => ({
      id: record.id,
      userId: record.userId,
      groupId: record.groupId,
      expenseId: record.expenseId,
      settlementId: record.settlementId,
      action: record.action,
      details: (record.details as Record<string, unknown> | null) ?? null,
      createdAt: record.createdAt,
      user: record.user
        ? {
            id: record.user.id,
            name: record.user.name,
            image: record.user.image,
          }
        : undefined,
      group: record.group
        ? {
            id: record.group.id,
            name: record.group.name,
          }
        : null,
    }));
  }

  async findMonthlySpending(userId: string, groupIds: string[]): Promise<MonthlySpending[]> {
    if (groupIds.length === 0) return getEmptySpendingChart();

    const chart: MonthlySpending[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

      const splits = await this.prisma.expenseSplit.findMany({
        where: {
          userId,
          expense: {
            groupId: { in: groupIds },
            date: { gte: start, lte: end },
            voidedAt: null,
          },
        },
        select: {
          allocationMinor: true,
          amountOwed: true,
        },
      });

      const total = splits.reduce((sum, s) => {
        const minor = s.allocationMinor ?? BigInt(Math.round(s.amountOwed * 100));
        return sum + minor;
      }, 0n);

      chart.push({
        month: date.toLocaleString("en-US", { month: "short" }),
        spendingMinor: total,
      });
    }
    return chart;
  }
}

function getEmptySpendingChart(): MonthlySpending[] {
  const chart: MonthlySpending[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    chart.push({
      month: d.toLocaleString("en-US", { month: "short" }),
      spendingMinor: 0n,
    });
  }
  return chart;
}

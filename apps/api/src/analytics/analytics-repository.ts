import { PrismaClient } from "@prisma/client";
import { AnalyticsQuery } from "@spenza/contracts";

export type CategorySpendingItem = {
  categoryId: string | null;
  categoryName: string;
  icon: string | null;
  color: string | null;
  totalMinor: bigint;
};

export type MonthlyTrendItem = {
  month: string;
  personalSpendingMinor: bigint;
  groupTotalMinor: bigint;
};

export type GroupSpendingItem = {
  groupId: string;
  groupName: string;
  personalSpendingMinor: bigint;
  totalExpensesMinor: bigint;
};

export type RawAnalyticsData = {
  personalSpendingMinor: bigint;
  totalContributedMinor: bigint;
  totalGroupExpensesMinor: bigint;
  currency: string;
  categoryBreakdown: CategorySpendingItem[];
  monthlyTrends: MonthlyTrendItem[];
  groupBreakdown: GroupSpendingItem[];
};

export interface AnalyticsRepository {
  findUserGroupIds(userId: string): Promise<string[]>;
  getAnalyticsData(
    userId: string,
    authorizedGroupIds: string[],
    query: AnalyticsQuery
  ): Promise<RawAnalyticsData>;
}

export class AnalyticsCurrencyMismatchError extends Error {
  constructor() {
    super("Analytics cannot combine groups with different currencies");
  }
}

export function resolveAnalyticsCurrency(currencies: string[]): string {
  const uniqueCurrencies = [...new Set(currencies)];
  if (uniqueCurrencies.length > 1) {
    throw new AnalyticsCurrencyMismatchError();
  }
  return uniqueCurrencies[0] ?? "USD";
}

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  async getAnalyticsData(
    userId: string,
    authorizedGroupIds: string[],
    query: AnalyticsQuery
  ): Promise<RawAnalyticsData> {
    if (authorizedGroupIds.length === 0) {
      return {
        personalSpendingMinor: 0n,
        totalContributedMinor: 0n,
        totalGroupExpensesMinor: 0n,
        currency: "USD",
        categoryBreakdown: [],
        monthlyTrends: getEmptyMonthlyTrends(),
        groupBreakdown: [],
      };
    }

    let targetGroupIds = authorizedGroupIds;
    if (query.groupId) {
      if (!authorizedGroupIds.includes(query.groupId)) {
        return {
          personalSpendingMinor: 0n,
          totalContributedMinor: 0n,
          totalGroupExpensesMinor: 0n,
          currency: "USD",
          categoryBreakdown: [],
          monthlyTrends: getEmptyMonthlyTrends(),
          groupBreakdown: [],
        };
      }
      targetGroupIds = [query.groupId];
    }

    const targetGroups = await this.prisma.group.findMany({
      where: { id: { in: targetGroupIds } },
      select: { currency: true },
    });
    const currency = resolveAnalyticsCurrency(targetGroups.map((group) => group.currency));

    const dateFilter = query.dateFrom || query.dateTo
      ? {
          date: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
          },
        }
      : {};

    const personalSplits = await this.prisma.expenseSplit.findMany({
      where: {
        userId,
        expense: {
          groupId: { in: targetGroupIds },
          voidedAt: null,
          ...dateFilter,
        },
      },
      select: {
        allocationMinor: true,
        amountOwed: true,
        expense: {
          select: {
            id: true,
            groupId: true,
            categoryId: true,
            currency: true,
            date: true,
            category: { select: { id: true, name: true, icon: true, color: true } },
            group: { select: { id: true, name: true } },
          },
        },
      },
    });

    const payments = await this.prisma.expensePayment.findMany({
      where: {
        userId,
        expense: {
          groupId: { in: targetGroupIds },
          voidedAt: null,
          ...dateFilter,
        },
      },
      select: { contributionMinor: true },
    });

    const groupExpenses = await this.prisma.expense.findMany({
      where: {
        groupId: { in: targetGroupIds },
        voidedAt: null,
        ...dateFilter,
      },
      select: {
        id: true,
        groupId: true,
        totalMinor: true,
        amount: true,
        date: true,
        group: { select: { id: true, name: true } },
      },
    });

    let personalSpendingMinor = 0n;
    const categoryMap = new Map<string, CategorySpendingItem>();
    const groupPersonalMap = new Map<string, bigint>();

    for (const split of personalSplits) {
      const minor = split.allocationMinor ?? BigInt(Math.round(split.amountOwed * 100));
      personalSpendingMinor += minor;

      const catKey = split.expense.categoryId ?? "uncategorized";
      const existingCat = categoryMap.get(catKey) ?? {
        categoryId: split.expense.categoryId,
        categoryName: split.expense.category?.name ?? "Uncategorized",
        icon: split.expense.category?.icon ?? null,
        color: split.expense.category?.color ?? null,
        totalMinor: 0n,
      };
      existingCat.totalMinor += minor;
      categoryMap.set(catKey, existingCat);

      if (split.expense.groupId) {
        const currentGroupSum = groupPersonalMap.get(split.expense.groupId) ?? 0n;
        groupPersonalMap.set(split.expense.groupId, currentGroupSum + minor);
      }
    }

    const totalContributedMinor = payments.reduce((sum, p) => sum + p.contributionMinor, 0n);

    let totalGroupExpensesMinor = 0n;
    const groupTotalMap = new Map<string, { name: string; totalMinor: bigint }>();

    for (const exp of groupExpenses) {
      const minor = exp.totalMinor ?? BigInt(Math.round(exp.amount * 100));
      totalGroupExpensesMinor += minor;

      if (exp.groupId && exp.group) {
        const existing = groupTotalMap.get(exp.groupId) ?? { name: exp.group.name, totalMinor: 0n };
        existing.totalMinor += minor;
        groupTotalMap.set(exp.groupId, existing);
      }
    }

    const monthlyTrends = getEmptyMonthlyTrends();
    for (const trend of monthlyTrends) {
      const [year, monthNum] = trend.monthKey.split("-").map(Number);
      const start = new Date(year, monthNum - 1, 1);
      const end = new Date(year, monthNum, 0, 23, 59, 59, 999);

      const monthPersonal = personalSplits
        .filter((s) => s.expense.date >= start && s.expense.date <= end)
        .reduce((sum, s) => sum + (s.allocationMinor ?? BigInt(Math.round(s.amountOwed * 100))), 0n);

      const monthGroup = groupExpenses
        .filter((e) => e.date >= start && e.date <= end)
        .reduce((sum, e) => sum + (e.totalMinor ?? BigInt(Math.round(e.amount * 100))), 0n);

      trend.personalSpendingMinor = monthPersonal;
      trend.groupTotalMinor = monthGroup;
    }

    const groupBreakdown: GroupSpendingItem[] = [];
    for (const [groupId, groupData] of groupTotalMap.entries()) {
      groupBreakdown.push({
        groupId,
        groupName: groupData.name,
        personalSpendingMinor: groupPersonalMap.get(groupId) ?? 0n,
        totalExpensesMinor: groupData.totalMinor,
      });
    }

    return {
      personalSpendingMinor,
      totalContributedMinor,
      totalGroupExpensesMinor,
      currency,
      categoryBreakdown: [...categoryMap.values()],
      monthlyTrends: monthlyTrends.map(({ month, personalSpendingMinor, groupTotalMinor }) => ({
        month,
        personalSpendingMinor,
        groupTotalMinor,
      })),
      groupBreakdown,
    };
  }
}

type MonthlyTrendInternal = {
  monthKey: string;
  month: string;
  personalSpendingMinor: bigint;
  groupTotalMinor: bigint;
};

function getEmptyMonthlyTrends(): MonthlyTrendInternal[] {
  const trends: MonthlyTrendInternal[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trends.push({
      monthKey,
      month: d.toLocaleString("en-US", { month: "short" }),
      personalSpendingMinor: 0n,
      groupTotalMinor: 0n,
    });
  }
  return trends;
}

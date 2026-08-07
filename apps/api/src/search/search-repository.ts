import { PrismaClient, Prisma } from "@prisma/client";
import { ExpenseRecord } from "../expenses/expense-repository.js";
import { ExpenseSearchQuery } from "@spenza/contracts";

export interface SearchRepository {
  findUserGroupIds(userId: string): Promise<string[]>;
  searchExpenses(
    userId: string,
    authorizedGroupIds: string[],
    query: ExpenseSearchQuery,
    cursorId?: string
  ): Promise<ExpenseRecord[]>;
}

export class PrismaSearchRepository implements SearchRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  async searchExpenses(
    _userId: string,
    authorizedGroupIds: string[],
    query: ExpenseSearchQuery,
    cursorId?: string
  ): Promise<ExpenseRecord[]> {
    if (authorizedGroupIds.length === 0) return [];

    let targetGroupIds = authorizedGroupIds;
    if (query.groupId) {
      if (!authorizedGroupIds.includes(query.groupId)) {
        return []; // Unauthorized group filter returns empty (hidden)
      }
      targetGroupIds = [query.groupId];
    }

    const where: Prisma.ExpenseWhereInput = {
      groupId: { in: targetGroupIds },
      voidedAt: null,
    };

    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    if (query.memberId) {
      where.OR = [
        ...(where.OR || []),
        { splits: { some: { userId: query.memberId } } },
        { payments: { some: { userId: query.memberId } } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.date = {};
      if (query.dateFrom) where.date.gte = new Date(query.dateFrom);
      if (query.dateTo) where.date.lte = new Date(query.dateTo);
    }

    if (query.minAmountMinor || query.maxAmountMinor) {
      where.totalMinor = {};
      if (query.minAmountMinor) where.totalMinor.gte = BigInt(query.minAmountMinor);
      if (query.maxAmountMinor) where.totalMinor.lte = BigInt(query.maxAmountMinor);
    }

    let cursorRecord: { date: Date; createdAt: Date; id: string } | null = null;
    if (cursorId) {
      cursorRecord = await this.prisma.expense.findUnique({
        where: { id: cursorId },
        select: { date: true, createdAt: true, id: true },
      });
    }

    if (cursorRecord) {
      where.AND = [
        {
          OR: [
            { date: { lt: cursorRecord.date } },
            {
              date: cursorRecord.date,
              createdAt: { lt: cursorRecord.createdAt },
            },
            {
              date: cursorRecord.date,
              createdAt: cursorRecord.createdAt,
              id: { lt: cursorRecord.id },
            },
          ],
        },
      ];
    }

    const take = query.limit + 1;
    const records = await this.prisma.expense.findMany({
      where,
      include: {
        payments: { select: { userId: true, contributionMinor: true, paymentOrder: true } },
        splits: { select: { userId: true, allocationMinor: true, allocationOrder: true, percentageBps: true, shareWeight: true, amountOwed: true } },
      },
      orderBy: [
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take,
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
}

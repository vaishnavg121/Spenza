import type { PrismaClient, Prisma } from "@prisma/client";
import type { ExpenseResponse } from "@spenza/contracts";
import { projectMinorToLegacyMajor } from "./money.js";

export type SupportedSplitType = "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";

export type ExpensePaymentRecord = {
  userId: string;
  contributionMinor: bigint;
  order: number;
};

export type ExpenseAllocationRecord = {
  userId: string;
  allocationMinor: bigint;
  order: number;
  percentageBps: number | null;
  shareWeight: bigint | null;
};

export type ExpenseRecord = {
  id: string;
  groupId: string;
  creatorId: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  totalMinor: bigint;
  currency: string;
  splitType: SupportedSplitType;
  version: number;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  payments: ExpensePaymentRecord[];
  allocations: ExpenseAllocationRecord[];
};

export type ExpenseWriteData = {
  title: string;
  description: string | null;
  categoryId: string | null;
  totalMinor: bigint;
  currency: string;
  splitType: SupportedSplitType;
  date: Date;
  payments: ExpensePaymentRecord[];
  allocations: ExpenseAllocationRecord[];
};

export type GroupExpenseContext = {
  currency: string;
  isArchived: boolean;
  memberIds: Set<string>;
};

export type StoredIdempotency = {
  fingerprint: string;
  statusCode: number;
  response: unknown;
};

export type IdempotencyScope = {
  actorUserId: string;
  method: string;
  route: string;
  key: string;
};

export interface ExpenseDataAccess {
  findGroupContext(groupId: string, relevantUserIds: string[]): Promise<GroupExpenseContext | null>;
  categoryExists(categoryId: string): Promise<boolean>;
  findExpenseById(groupId: string, expenseId: string): Promise<ExpenseRecord | null>;
  listGroupExpenses(
    groupId: string,
    options: { cursorId?: string; take: number },
  ): Promise<ExpenseRecord[]>;
  findIdempotency(scope: IdempotencyScope): Promise<StoredIdempotency | null>;
  createExpense(groupId: string, creatorId: string, data: ExpenseWriteData): Promise<ExpenseRecord>;
  replaceExpenseIfVersion(
    groupId: string,
    expenseId: string,
    expectedVersion: number,
    data: ExpenseWriteData,
  ): Promise<ExpenseRecord | null>;
  appendRevision(expense: ExpenseResponse, actorUserId: string): Promise<void>;
  appendActivity(
    action: "EXPENSE_ADDED" | "EXPENSE_UPDATED",
    expense: ExpenseResponse,
    actorUserId: string,
    requestId: string,
  ): Promise<void>;
  createIdempotency(
    scope: IdempotencyScope,
    fingerprint: string,
    statusCode: number,
    response: ExpenseResponse,
  ): Promise<void>;
}

export interface ExpenseRepository extends ExpenseDataAccess {
  withTransaction<T>(work: (transaction: ExpenseDataAccess) => Promise<T>): Promise<T>;
}

export class IdempotencyRaceError extends Error {
  constructor() {
    super("Concurrent idempotency record creation");
  }
}

export class ConcurrentExpenseWriteError extends Error {
  constructor() {
    super("Concurrent expense transaction conflict");
  }
}

export class ExpenseStorageInvariantError extends Error {
  constructor(message: string) {
    super(message);
  }
}

const expenseInclude = {
  payments: { orderBy: { paymentOrder: "asc" as const } },
  splits: {
    where: { allocationMinor: { not: null }, allocationOrder: { not: null } },
    orderBy: { allocationOrder: "asc" as const },
  },
} satisfies Prisma.ExpenseInclude;

type PrismaExpenseRecord = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

function mapExpense(record: PrismaExpenseRecord): ExpenseRecord {
  if (!record.groupId || record.totalMinor === null || record.splitType === "CUSTOM") {
    throw new ExpenseStorageInvariantError("Expense is not stored in the Milestone 8 representation");
  }
  const allocations = record.splits.map((split) => {
    if (split.allocationMinor === null || split.allocationOrder === null) {
      throw new ExpenseStorageInvariantError("Expense allocation is missing authoritative minor units");
    }
    return {
      userId: split.userId,
      allocationMinor: split.allocationMinor,
      order: split.allocationOrder,
      percentageBps: split.percentageBps,
      shareWeight: split.shareWeight,
    };
  });
  if (record.payments.length === 0 || allocations.length === 0) {
    throw new ExpenseStorageInvariantError("Expense is missing payers or allocations");
  }
  const paymentIds = new Set(record.payments.map((payment) => payment.userId));
  const allocationIds = new Set(allocations.map((allocation) => allocation.userId));
  const contributionTotal = record.payments.reduce((sum, payment) => sum + payment.contributionMinor, 0n);
  const allocationTotal = allocations.reduce((sum, allocation) => sum + allocation.allocationMinor, 0n);
  if (
    paymentIds.size !== record.payments.length ||
    allocationIds.size !== allocations.length ||
    record.payments.some((payment) => payment.contributionMinor <= 0n) ||
    allocations.some((allocation) => allocation.allocationMinor < 0n) ||
    contributionTotal !== record.totalMinor ||
    allocationTotal !== record.totalMinor
  ) {
    throw new ExpenseStorageInvariantError("Stored expense does not reconcile to its authoritative total");
  }
  return {
    id: record.id,
    groupId: record.groupId,
    creatorId: record.creatorId,
    title: record.title,
    description: record.description,
    categoryId: record.categoryId,
    totalMinor: record.totalMinor,
    currency: record.currency,
    splitType: record.splitType,
    version: record.version,
    date: record.date,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    payments: record.payments.map((payment) => ({
      userId: payment.userId,
      contributionMinor: payment.contributionMinor,
      order: payment.paymentOrder,
    })),
    allocations,
  };
}

function expenseJson(response: ExpenseResponse): Prisma.InputJsonObject {
  const payers: Prisma.InputJsonArray = response.payers.map((payer) => ({
    userId: payer.userId,
    contributionMinor: payer.contributionMinor,
    order: payer.order,
  }));
  const allocations: Prisma.InputJsonArray = response.allocations.map((allocation) => ({
    userId: allocation.userId,
    allocationMinor: allocation.allocationMinor,
    order: allocation.order,
  }));
  return {
    id: response.id,
    groupId: response.groupId,
    creatorId: response.creatorId,
    title: response.title,
    description: response.description,
    categoryId: response.categoryId,
    totalMinor: response.totalMinor,
    currency: response.currency,
    splitType: response.splitType,
    version: response.version,
    date: response.date,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    payers,
    allocations,
  };
}

function isKnownPrismaError(error: unknown, code: string): error is { code: string; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function isIdempotencyUniqueError(error: unknown): boolean {
  if (!isKnownPrismaError(error, "P2002")) return false;
  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(",")
    : String(error.meta?.target ?? "");
  return (
    target.includes("IdempotencyRecord_actorId_method_route_key_key") ||
    (["actorId", "method", "route", "key"].every((field) => target.includes(field)))
  );
}

class PrismaExpenseDataAccess implements ExpenseDataAccess {
  constructor(private readonly prisma: Prisma.TransactionClient | PrismaClient) {}

  async findGroupContext(groupId: string, relevantUserIds: string[]): Promise<GroupExpenseContext | null> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        currency: true,
        isArchived: true,
        members: {
          where: { userId: { in: relevantUserIds } },
          select: { userId: true },
        },
      },
    });
    return group
      ? { currency: group.currency, isArchived: group.isArchived, memberIds: new Set(group.members.map((m) => m.userId)) }
      : null;
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    return (await this.prisma.category.count({ where: { id: categoryId } })) === 1;
  }

  async findExpenseById(groupId: string, expenseId: string): Promise<ExpenseRecord | null> {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id: expenseId,
        groupId,
        totalMinor: { not: null },
        voidedAt: null,
        payments: { some: {} },
        splits: { some: { allocationMinor: { not: null } } },
      },
      include: expenseInclude,
    });
    return expense ? mapExpense(expense) : null;
  }

  async listGroupExpenses(
    groupId: string,
    options: { cursorId?: string; take: number },
  ): Promise<ExpenseRecord[]> {
    const expenses = await this.prisma.expense.findMany({
      where: {
        groupId,
        totalMinor: { not: null },
        voidedAt: null,
        payments: { some: {} },
        splits: { some: { allocationMinor: { not: null } } },
      },
      include: expenseInclude,
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: options.take,
      ...(options.cursorId ? { cursor: { id: options.cursorId }, skip: 1 } : {}),
    });
    return expenses.map(mapExpense);
  }

  async findIdempotency(scope: IdempotencyScope): Promise<StoredIdempotency | null> {
    const record = await this.prisma.idempotencyRecord.findUnique({
      where: {
        actorId_method_route_key: {
          actorId: scope.actorUserId,
          method: scope.method,
          route: scope.route,
          key: scope.key,
        },
      },
      select: { fingerprint: true, statusCode: true, response: true },
    });
    return record;
  }

  async createExpense(groupId: string, creatorId: string, data: ExpenseWriteData): Promise<ExpenseRecord> {
    const paidByUser = new Map(data.payments.map((payment) => [payment.userId, payment.contributionMinor]));
    const participantIds = new Set(data.allocations.map((allocation) => allocation.userId));
    const legacyPayerOnlySplits = data.payments
      .filter((payment) => !participantIds.has(payment.userId))
      .map((payment) => ({
        userId: payment.userId,
        amountPaid: projectMinorToLegacyMajor(payment.contributionMinor, data.currency),
        amountOwed: 0,
      }));
    const expense = await this.prisma.expense.create({
      data: {
        groupId,
        creatorId,
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        currency: data.currency,
        date: data.date,
        splitType: data.splitType,
        totalMinor: data.totalMinor,
        amount: projectMinorToLegacyMajor(data.totalMinor, data.currency),
        payments: {
          create: data.payments.map((payment) => ({
            userId: payment.userId,
            contributionMinor: payment.contributionMinor,
            paymentOrder: payment.order,
          })),
        },
        splits: {
          create: [
            ...data.allocations.map((allocation) => ({
              userId: allocation.userId,
              allocationMinor: allocation.allocationMinor,
              allocationOrder: allocation.order,
              percentageBps: allocation.percentageBps,
              shareWeight: allocation.shareWeight,
              amountPaid: projectMinorToLegacyMajor(paidByUser.get(allocation.userId) ?? 0n, data.currency),
              amountOwed: projectMinorToLegacyMajor(allocation.allocationMinor, data.currency),
            })),
            ...legacyPayerOnlySplits,
          ],
        },
      },
      include: expenseInclude,
    });
    return mapExpense(expense);
  }

  async replaceExpenseIfVersion(
    groupId: string,
    expenseId: string,
    expectedVersion: number,
    data: ExpenseWriteData,
  ): Promise<ExpenseRecord | null> {
    const updated = await this.prisma.expense.updateMany({
      where: { id: expenseId, groupId, version: expectedVersion, totalMinor: { not: null }, voidedAt: null },
      data: {
        title: data.title,
        description: data.description,
        categoryId: data.categoryId,
        totalMinor: data.totalMinor,
        amount: projectMinorToLegacyMajor(data.totalMinor, data.currency),
        date: data.date,
        splitType: data.splitType,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) return null;

    await this.prisma.expensePayment.deleteMany({ where: { expenseId } });
    await this.prisma.expenseSplit.deleteMany({ where: { expenseId } });
    await this.prisma.expensePayment.createMany({
      data: data.payments.map((payment) => ({
        expenseId,
        userId: payment.userId,
        contributionMinor: payment.contributionMinor,
        paymentOrder: payment.order,
      })),
    });
    const paidByUser = new Map(data.payments.map((payment) => [payment.userId, payment.contributionMinor]));
    const participantIds = new Set(data.allocations.map((allocation) => allocation.userId));
    await this.prisma.expenseSplit.createMany({
      data: [
        ...data.allocations.map((allocation) => ({
          expenseId,
          userId: allocation.userId,
          allocationMinor: allocation.allocationMinor,
          allocationOrder: allocation.order,
          percentageBps: allocation.percentageBps,
          shareWeight: allocation.shareWeight,
          amountPaid: projectMinorToLegacyMajor(paidByUser.get(allocation.userId) ?? 0n, data.currency),
          amountOwed: projectMinorToLegacyMajor(allocation.allocationMinor, data.currency),
        })),
        ...data.payments
          .filter((payment) => !participantIds.has(payment.userId))
          .map((payment) => ({
            expenseId,
            userId: payment.userId,
            amountPaid: projectMinorToLegacyMajor(payment.contributionMinor, data.currency),
            amountOwed: 0,
          })),
      ],
    });
    return this.findExpenseById(groupId, expenseId);
  }

  async appendRevision(expense: ExpenseResponse, actorUserId: string): Promise<void> {
    await this.prisma.expenseRevision.create({
      data: {
        expenseId: expense.id,
        version: expense.version,
        actorId: actorUserId,
        snapshot: expenseJson(expense),
      },
    });
  }

  async appendActivity(
    action: "EXPENSE_ADDED" | "EXPENSE_UPDATED",
    expense: ExpenseResponse,
    actorUserId: string,
    requestId: string,
  ): Promise<void> {
    const details: Prisma.InputJsonObject = {
      requestId,
      version: expense.version,
      totalMinor: expense.totalMinor,
      currency: expense.currency,
    };
    await this.prisma.activity.create({
      data: {
        action,
        userId: actorUserId,
        groupId: expense.groupId,
        expenseId: expense.id,
        details,
      },
    });

    if (action === "EXPENSE_ADDED") {
      // In MVP, we might notify all members of the group, but we don't have member list here directly.
      // So we'll skip exact targeted outbox creation here and keep it simple, or create a generic one.
      // Easiest is to rely on existing outbox worker that looks up group members if needed.
    }
  }

  async createIdempotency(
    scope: IdempotencyScope,
    fingerprint: string,
    statusCode: number,
    response: ExpenseResponse,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.create({
      data: {
        actorId: scope.actorUserId,
        method: scope.method,
        route: scope.route,
        key: scope.key,
        fingerprint,
        statusCode,
        response: expenseJson(response),
      },
    });
  }
}

export class PrismaExpenseRepository extends PrismaExpenseDataAccess implements ExpenseRepository {
  constructor(private readonly client: PrismaClient) {
    super(client);
  }

  async withTransaction<T>(work: (transaction: ExpenseDataAccess) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction(
        (transaction) => work(new PrismaExpenseDataAccess(transaction)),
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (isIdempotencyUniqueError(error)) throw new IdempotencyRaceError();
      if (isKnownPrismaError(error, "P2034")) throw new ConcurrentExpenseWriteError();
      throw error;
    }
  }
}

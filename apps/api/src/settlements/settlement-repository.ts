import type { Prisma, PrismaClient } from "@prisma/client";
import type { SettlementResponse } from "@spenza/contracts";
import { projectMinorToLegacyMajor } from "../expenses/money.js";
import type { LedgerExpense, LedgerSettlement } from "./balance-engine.js";

export type SettlementRecord = {
  id: string;
  groupId: string;
  payerId: string;
  receiverId: string;
  amountMinor: bigint;
  currency: string;
  method: "CASH" | "UPI" | "BANK_TRANSFER" | "OTHER";
  kind: "PAYMENT" | "REVERSAL";
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  reversesId: string | null;
  createdById: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type GroupLedger = {
  currency: string;
  isArchived: boolean;
  currentMemberIds: Set<string>;
  knownUserIds: Set<string>;
  expenses: LedgerExpense[];
  settlements: LedgerSettlement[];
};

export type SettlementIdempotencyScope = {
  actorUserId: string;
  method: "POST";
  route: string;
  key: string;
};

export type StoredSettlementIdempotency = { fingerprint: string; response: unknown };

export interface SettlementDataAccess {
  loadGroupLedger(groupId: string): Promise<GroupLedger | null>;
  findSettlement(groupId: string, settlementId: string): Promise<SettlementRecord | null>;
  findReversal(groupId: string, originalSettlementId: string): Promise<SettlementRecord | null>;
  listSettlements(groupId: string, options: { cursorId?: string; take: number }): Promise<SettlementRecord[]>;
  findIdempotency(scope: SettlementIdempotencyScope): Promise<StoredSettlementIdempotency | null>;
  createSettlement(input: {
    groupId: string;
    payerId: string;
    receiverId: string;
    amountMinor: bigint;
    currency: string;
    method: SettlementRecord["method"];
    date: Date;
    createdById: string;
  }): Promise<SettlementRecord>;
  createReversal(original: SettlementRecord, actorUserId: string, date: Date): Promise<SettlementRecord>;
  appendActivity(
    action: "SETTLEMENT_MADE" | "SETTLEMENT_REVERSED",
    settlement: SettlementResponse,
    actorUserId: string,
    requestId: string,
  ): Promise<void>;
  createIdempotency(
    scope: SettlementIdempotencyScope,
    fingerprint: string,
    response: SettlementResponse,
  ): Promise<void>;
}

export interface SettlementRepository extends SettlementDataAccess {
  withTransaction<T>(work: (transaction: SettlementDataAccess) => Promise<T>): Promise<T>;
}

export class SettlementStorageInvariantError extends Error {}
export class SettlementIdempotencyRaceError extends Error {}
export class SettlementConcurrentWriteError extends Error {}
export class SettlementAlreadyReversedError extends Error {}

function mapSettlement(record: {
  id: string;
  groupId: string | null;
  payerId: string;
  payeeId: string;
  amountMinor: bigint | null;
  currency: string;
  method: SettlementRecord["method"];
  kind: SettlementRecord["kind"];
  status: SettlementRecord["status"];
  reversesId: string | null;
  createdById: string | null;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}): SettlementRecord {
  if (!record.groupId || record.amountMinor === null || record.amountMinor <= 0n || record.payerId === record.payeeId) {
    throw new SettlementStorageInvariantError("Settlement is not stored in the Milestone 9 representation");
  }
  if ((record.kind === "PAYMENT") !== (record.reversesId === null)) {
    throw new SettlementStorageInvariantError("Settlement reversal linkage is inconsistent");
  }
  return {
    id: record.id,
    groupId: record.groupId,
    payerId: record.payerId,
    receiverId: record.payeeId,
    amountMinor: record.amountMinor,
    currency: record.currency,
    method: record.method,
    kind: record.kind,
    status: record.status,
    reversesId: record.reversesId,
    createdById: record.createdById,
    date: record.date,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function settlementJson(response: SettlementResponse): Prisma.InputJsonObject {
  return {
    id: response.id,
    groupId: response.groupId,
    payerId: response.payerId,
    receiverId: response.receiverId,
    amountMinor: response.amountMinor,
    currency: response.currency,
    method: response.method,
    kind: response.kind,
    status: response.status,
    reversesId: response.reversesId,
    createdById: response.createdById,
    date: response.date,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
  };
}

function knownPrismaError(error: unknown, code: string): error is { code: string; meta?: { target?: unknown } } {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

function targetText(error: { meta?: { target?: unknown } }): string {
  return Array.isArray(error.meta?.target) ? error.meta.target.join(",") : String(error.meta?.target ?? "");
}

class PrismaSettlementDataAccess implements SettlementDataAccess {
  constructor(private readonly prisma: Prisma.TransactionClient | PrismaClient) {}

  async loadGroupLedger(groupId: string): Promise<GroupLedger | null> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        currency: true,
        isArchived: true,
        members: { select: { userId: true } },
        expenses: {
          where: { voidedAt: null },
          select: {
            currency: true,
            totalMinor: true,
            payments: { select: { userId: true, contributionMinor: true } },
            splits: {
              where: { allocationMinor: { not: null }, allocationOrder: { not: null } },
              select: { userId: true, allocationMinor: true },
            },
          },
        },
        settlements: {
          where: { status: "COMPLETED" },
          select: {
            payerId: true,
            payeeId: true,
            amountMinor: true,
            currency: true,
            kind: true,
          },
        },
      },
    });
    if (!group) return null;
    const currentMemberIds = new Set(group.members.map((member) => member.userId));
    const knownUserIds = new Set(currentMemberIds);
    const expenses: LedgerExpense[] = group.expenses.map((expense) => {
      if (expense.totalMinor === null || expense.payments.length === 0 || expense.splits.length === 0) {
        throw new SettlementStorageInvariantError("Group contains an unreconciled legacy expense");
      }
      const payments = expense.payments.map((payment) => {
        knownUserIds.add(payment.userId);
        return payment;
      });
      const allocations = expense.splits.map((allocation) => {
        if (allocation.allocationMinor === null) {
          throw new SettlementStorageInvariantError("Expense allocation is missing minor units");
        }
        knownUserIds.add(allocation.userId);
        return { userId: allocation.userId, allocationMinor: allocation.allocationMinor };
      });
      return { currency: expense.currency, totalMinor: expense.totalMinor, payments, allocations };
    });
    const settlements: LedgerSettlement[] = group.settlements.map((settlement) => {
      if (settlement.amountMinor === null) {
        throw new SettlementStorageInvariantError("Group contains an unreconciled legacy settlement");
      }
      knownUserIds.add(settlement.payerId);
      knownUserIds.add(settlement.payeeId);
      return {
        currency: settlement.currency,
        payerId: settlement.payerId,
        receiverId: settlement.payeeId,
        amountMinor: settlement.amountMinor,
        kind: settlement.kind,
      };
    });
    return { currency: group.currency, isArchived: group.isArchived, currentMemberIds, knownUserIds, expenses, settlements };
  }

  async findSettlement(groupId: string, settlementId: string): Promise<SettlementRecord | null> {
    const settlement = await this.prisma.settlement.findFirst({
      where: { id: settlementId, groupId, amountMinor: { not: null }, status: "COMPLETED" },
    });
    return settlement ? mapSettlement(settlement) : null;
  }

  async findReversal(groupId: string, originalSettlementId: string): Promise<SettlementRecord | null> {
    const reversal = await this.prisma.settlement.findFirst({
      where: {
        groupId,
        reversesId: originalSettlementId,
        kind: "REVERSAL",
        amountMinor: { not: null },
        status: "COMPLETED",
      },
    });
    return reversal ? mapSettlement(reversal) : null;
  }

  async listSettlements(groupId: string, options: { cursorId?: string; take: number }): Promise<SettlementRecord[]> {
    const settlements = await this.prisma.settlement.findMany({
      where: { groupId, amountMinor: { not: null }, status: "COMPLETED" },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: options.take,
      ...(options.cursorId ? { cursor: { id: options.cursorId }, skip: 1 } : {}),
    });
    return settlements.map(mapSettlement);
  }

  async findIdempotency(scope: SettlementIdempotencyScope): Promise<StoredSettlementIdempotency | null> {
    return this.prisma.idempotencyRecord.findUnique({
      where: { actorId_method_route_key: {
        actorId: scope.actorUserId,
        method: scope.method,
        route: scope.route,
        key: scope.key,
      } },
      select: { fingerprint: true, response: true },
    });
  }

  async createSettlement(input: {
    groupId: string;
    payerId: string;
    receiverId: string;
    amountMinor: bigint;
    currency: string;
    method: SettlementRecord["method"];
    date: Date;
    createdById: string;
  }): Promise<SettlementRecord> {
    const created = await this.prisma.settlement.create({
      data: {
        groupId: input.groupId,
        payerId: input.payerId,
        payeeId: input.receiverId,
        amountMinor: input.amountMinor,
        amount: projectMinorToLegacyMajor(input.amountMinor, input.currency),
        currency: input.currency,
        method: input.method,
        kind: "PAYMENT",
        status: "COMPLETED",
        date: input.date,
        createdById: input.createdById,
      },
    });

    await this.prisma.outboxEvent.create({
      data: {
        type: "SETTLEMENT_MADE",
        payload: {
          userId: input.receiverId,
          title: "New Payment",
          body: `You received a payment.`,
          type: "SETTLEMENT_COMPLETED",
        },
      },
    });

    return mapSettlement(created);
  }

  async createReversal(original: SettlementRecord, actorUserId: string, date: Date): Promise<SettlementRecord> {
    return mapSettlement(await this.prisma.settlement.create({
      data: {
        groupId: original.groupId,
        payerId: original.payerId,
        payeeId: original.receiverId,
        amountMinor: original.amountMinor,
        amount: projectMinorToLegacyMajor(original.amountMinor, original.currency),
        currency: original.currency,
        method: original.method,
        kind: "REVERSAL",
        status: "COMPLETED",
        reversesId: original.id,
        createdById: actorUserId,
        date,
      },
    }));
  }

  async appendActivity(
    action: "SETTLEMENT_MADE" | "SETTLEMENT_REVERSED",
    settlement: SettlementResponse,
    actorUserId: string,
    requestId: string,
  ): Promise<void> {
    const details: Prisma.InputJsonObject = {
      requestId,
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      kind: settlement.kind,
      reversesId: settlement.reversesId,
    };
    await this.prisma.activity.create({
      data: {
        userId: actorUserId,
        groupId: settlement.groupId,
        settlementId: settlement.id,
        action,
        details,
      },
    });
  }

  async createIdempotency(
    scope: SettlementIdempotencyScope,
    fingerprint: string,
    response: SettlementResponse,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.create({
      data: {
        actorId: scope.actorUserId,
        method: scope.method,
        route: scope.route,
        key: scope.key,
        fingerprint,
        statusCode: 201,
        response: settlementJson(response),
      },
    });
  }
}

export class PrismaSettlementRepository extends PrismaSettlementDataAccess implements SettlementRepository {
  constructor(private readonly client: PrismaClient) {
    super(client);
  }

  async withTransaction<T>(work: (transaction: SettlementDataAccess) => Promise<T>): Promise<T> {
    try {
      return await this.client.$transaction(
        (transaction) => work(new PrismaSettlementDataAccess(transaction)),
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (knownPrismaError(error, "P2002")) {
        const target = targetText(error);
        if (["actorId", "method", "route", "key"].every((field) => target.includes(field))) {
          throw new SettlementIdempotencyRaceError();
        }
        if (target.includes("reversesId")) throw new SettlementAlreadyReversedError();
      }
      if (knownPrismaError(error, "P2034")) throw new SettlementConcurrentWriteError();
      throw error;
    }
  }
}

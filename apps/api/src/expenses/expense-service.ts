import { createHash } from "node:crypto";
import {
  ExpenseResponseSchema,
  type CreateExpenseInput,
  type ExpensePage,
  type ExpenseResponse,
  type ExpenseSplitInput,
  type UpdateExpenseInput,
} from "@spenza/contracts";
import {
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from "../errors/app-error.js";
import { calculateSplit, SplitValidationError, validatePayers, type SplitInput } from "./split-engine.js";
import { currencyExponent } from "./money.js";
import {
  ConcurrentExpenseWriteError,
  ExpenseStorageInvariantError,
  IdempotencyRaceError,
  type ExpenseAllocationRecord,
  type ExpenseDataAccess,
  type ExpensePaymentRecord,
  type ExpenseRecord,
  type ExpenseRepository,
  type ExpenseWriteData,
  type GroupExpenseContext,
  type IdempotencyScope,
} from "./expense-repository.js";

export type CreateExpenseResult = { expense: ExpenseResponse; replayed: boolean };

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Fingerprint input contains an unsafe number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
  }
  throw new Error("Fingerprint input is not JSON-compatible");
}

function fingerprint(input: CreateExpenseInput): string {
  return createHash("sha256").update(canonicalJson(input), "utf8").digest("hex");
}

function parseSplitInput(input: ExpenseSplitInput): SplitInput {
  switch (input.type) {
    case "EQUAL":
      return input;
    case "EXACT":
      return {
        type: input.type,
        participants: input.participants.map((participant) => ({
          userId: participant.userId,
          amountMinor: BigInt(participant.amountMinor),
        })),
      };
    case "PERCENTAGE":
      return {
        type: input.type,
        participants: input.participants.map((participant) => ({
          userId: participant.userId,
          percentageBps: BigInt(participant.percentageBps),
        })),
      };
    case "SHARES":
      return {
        type: input.type,
        participants: input.participants.map((participant) => ({
          userId: participant.userId,
          shares: BigInt(participant.shares),
        })),
      };
  }
}

function reconstructSplit(expense: ExpenseRecord): ExpenseSplitInput {
  switch (expense.splitType) {
    case "EQUAL":
      return {
        type: "EQUAL",
        participants: expense.allocations.map(({ userId }) => ({ userId })),
      };
    case "EXACT":
      return {
        type: "EXACT",
        participants: expense.allocations.map(({ userId, allocationMinor }) => ({
          userId,
          amountMinor: allocationMinor.toString(),
        })),
      };
    case "PERCENTAGE":
      return {
        type: "PERCENTAGE",
        participants: expense.allocations.map(({ userId, percentageBps }) => {
          if (percentageBps === null) {
            throw new ExpenseStorageInvariantError("Percentage split is missing basis points");
          }
          return { userId, percentageBps };
        }),
      };
    case "SHARES":
      return {
        type: "SHARES",
        participants: expense.allocations.map(({ userId, shareWeight }) => {
          if (shareWeight === null || shareWeight > 1_000_000n) {
            throw new ExpenseStorageInvariantError("Share split is missing a supported weight");
          }
          return { userId, shares: Number(shareWeight) };
        }),
      };
  }
}

export function serializeExpense(expense: ExpenseRecord): ExpenseResponse {
  return ExpenseResponseSchema.parse({
    id: expense.id,
    groupId: expense.groupId,
    creatorId: expense.creatorId,
    title: expense.title,
    description: expense.description,
    categoryId: expense.categoryId,
    totalMinor: expense.totalMinor.toString(),
    currency: expense.currency,
    splitType: expense.splitType,
    version: expense.version,
    date: expense.date.toISOString(),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    payers: expense.payments.map((payment) => ({
      userId: payment.userId,
      contributionMinor: payment.contributionMinor.toString(),
      order: payment.order,
    })),
    allocations: expense.allocations.map((allocation) => ({
      userId: allocation.userId,
      allocationMinor: allocation.allocationMinor.toString(),
      order: allocation.order,
    })),
  });
}

function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    if (!decoded || encodeCursor(decoded) !== cursor) throw new Error("Non-canonical cursor");
    return decoded;
  } catch {
    throw new ValidationError("Invalid expense cursor");
  }
}

export class ExpenseService {
  constructor(private readonly repository: ExpenseRepository) {}

  async createExpense(
    actorUserId: string,
    groupId: string,
    idempotencyKey: string,
    input: CreateExpenseInput,
    requestId: string,
  ): Promise<CreateExpenseResult> {
    const scope: IdempotencyScope = {
      actorUserId,
      method: "POST",
      route: `/v1/groups/${groupId}/expenses`,
      key: idempotencyKey,
    };
    const requestFingerprint = fingerprint(input);

    try {
      return await this.repository.withTransaction(async (transaction) => {
        const prepared = await this.prepareWrite(transaction, actorUserId, groupId, input);
        const stored = await transaction.findIdempotency(scope);
        if (stored) return { expense: this.replay(stored, requestFingerprint), replayed: true };

        const created = await transaction.createExpense(groupId, actorUserId, prepared);
        const response = serializeExpense(created);
        await transaction.appendRevision(response, actorUserId);
        await transaction.appendActivity("EXPENSE_ADDED", response, actorUserId, requestId);
        await transaction.createIdempotency(scope, requestFingerprint, 201, response);
        return { expense: response, replayed: false };
      });
    } catch (error) {
      if (error instanceof IdempotencyRaceError || error instanceof ConcurrentExpenseWriteError) {
        const stored = await this.repository.findIdempotency(scope);
        if (stored) {
          await this.requireActorMembership(this.repository, actorUserId, groupId);
          return { expense: this.replay(stored, requestFingerprint), replayed: true };
        }
        throw new ConflictError("Concurrent expense request could not be completed", "EXPENSE_WRITE_CONFLICT");
      }
      throw error;
    }
  }

  async listExpenses(
    actorUserId: string,
    groupId: string,
    options: { cursor?: string; limit: number },
  ): Promise<ExpensePage> {
    await this.requireActorMembership(this.repository, actorUserId, groupId);
    const cursorId = decodeCursor(options.cursor);
    const rows = await this.repository.listGroupExpenses(groupId, { cursorId, take: options.limit + 1 });
    const hasMore = rows.length > options.limit;
    const visible = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      data: visible.map(serializeExpense),
      page: {
        hasMore,
        nextCursor: hasMore && visible.length > 0 ? encodeCursor(visible[visible.length - 1].id) : null,
      },
    };
  }

  async getExpense(actorUserId: string, groupId: string, expenseId: string): Promise<ExpenseResponse> {
    await this.requireActorMembership(this.repository, actorUserId, groupId);
    const expense = await this.repository.findExpenseById(groupId, expenseId);
    if (!expense) throw new NotFoundError("Expense not found");
    return serializeExpense(expense);
  }

  async updateExpense(
    actorUserId: string,
    groupId: string,
    expenseId: string,
    input: UpdateExpenseInput,
    requestId: string,
  ): Promise<ExpenseResponse> {
    try {
      return await this.repository.withTransaction(async (transaction) => {
        const actorContext = await this.requireActorMembership(transaction, actorUserId, groupId);
        if (actorContext.isArchived) {
          throw new UnprocessableEntityError("Archived groups cannot accept expense changes", "GROUP_ARCHIVED");
        }
        const existing = await transaction.findExpenseById(groupId, expenseId);
        if (!existing) throw new NotFoundError("Expense not found");
        if (existing.version !== input.expectedVersion) {
          throw new ConflictError("Expense version is stale", "VERSION_CONFLICT");
        }

        const split = input.split ?? reconstructSplit(existing);
        const payers = input.payers ?? existing.payments.map((payment) => ({
          userId: payment.userId,
          amountMinor: payment.contributionMinor.toString(),
        }));
        const merged: CreateExpenseInput = {
          title: input.title ?? existing.title,
          description: input.description !== undefined ? input.description : existing.description,
          categoryId: input.categoryId !== undefined ? input.categoryId : existing.categoryId,
          totalMinor: input.totalMinor ?? existing.totalMinor.toString(),
          currency: existing.currency,
          date: input.date ?? existing.date.toISOString(),
          payers,
          split,
        };
        const prepared = await this.prepareWrite(transaction, actorUserId, groupId, merged);
        const updated = await transaction.replaceExpenseIfVersion(groupId, expenseId, input.expectedVersion, prepared);
        if (!updated) throw new ConflictError("Expense version is stale", "VERSION_CONFLICT");
        const response = serializeExpense(updated);
        await transaction.appendRevision(response, actorUserId);
        await transaction.appendActivity("EXPENSE_UPDATED", response, actorUserId, requestId);
        return response;
      });
    } catch (error) {
      if (error instanceof ConcurrentExpenseWriteError) {
        throw new ConflictError("Expense version is stale", "VERSION_CONFLICT");
      }
      throw error;
    }
  }

  private async prepareWrite(
    dataAccess: ExpenseDataAccess,
    actorUserId: string,
    groupId: string,
    input: CreateExpenseInput,
  ): Promise<ExpenseWriteData> {
    const payerIds = input.payers.map((payer) => payer.userId);
    const participantIds = input.split.participants.map((participant) => participant.userId);
    const relevantIds = [...new Set([actorUserId, ...payerIds, ...participantIds])];
    const context = await dataAccess.findGroupContext(groupId, relevantIds);
    this.assertAuthorizedMembers(context, actorUserId, payerIds, participantIds);
    if (context.isArchived) {
      throw new UnprocessableEntityError("Archived groups cannot accept expenses", "GROUP_ARCHIVED");
    }
    if (context.currency !== input.currency) {
      throw new UnprocessableEntityError("Expense currency must match the group currency", "CURRENCY_MISMATCH");
    }
    try {
      currencyExponent(input.currency);
    } catch {
      throw new UnprocessableEntityError("Expense currency is not supported", "UNSUPPORTED_CURRENCY");
    }
    if (input.categoryId && !(await dataAccess.categoryExists(input.categoryId))) {
      throw new UnprocessableEntityError("Expense category is invalid", "INVALID_CATEGORY");
    }

    const totalMinor = BigInt(input.totalMinor);
    const payments: ExpensePaymentRecord[] = input.payers.map((payer, order) => ({
      userId: payer.userId,
      contributionMinor: BigInt(payer.amountMinor),
      order,
    }));
    const splitInput = parseSplitInput(input.split);
    try {
      validatePayers(totalMinor, payments);
      const allocations = calculateSplit(totalMinor, splitInput);
      const allocationRecords: ExpenseAllocationRecord[] = allocations.map((allocation) => {
        const participant = input.split.participants[allocation.order];
        return {
          ...allocation,
          percentageBps: input.split.type === "PERCENTAGE" ? input.split.participants[allocation.order].percentageBps : null,
          shareWeight: input.split.type === "SHARES" ? BigInt(input.split.participants[allocation.order].shares) : null,
          userId: participant.userId,
        };
      });
      return {
        title: input.title,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        totalMinor,
        currency: input.currency,
        splitType: input.split.type,
        date: input.date ? new Date(input.date) : new Date(),
        payments,
        allocations: allocationRecords,
      };
    } catch (error) {
      if (error instanceof SplitValidationError) {
        throw new UnprocessableEntityError(error.message, error.code);
      }
      throw error;
    }
  }

  private assertAuthorizedMembers(
    context: GroupExpenseContext | null,
    actorUserId: string,
    payerIds: string[],
    participantIds: string[],
  ): asserts context is GroupExpenseContext {
    if (!context || !context.memberIds.has(actorUserId)) throw new NotFoundError("Group not found");
    if (payerIds.some((userId) => !context.memberIds.has(userId))) {
      throw new UnprocessableEntityError("Every payer must be a current group member", "INVALID_PAYER");
    }
    if (participantIds.some((userId) => !context.memberIds.has(userId))) {
      throw new UnprocessableEntityError("Every participant must be a current group member", "INVALID_PARTICIPANT");
    }
  }

  private async requireActorMembership(
    dataAccess: ExpenseDataAccess,
    actorUserId: string,
    groupId: string,
  ): Promise<GroupExpenseContext> {
    const context = await dataAccess.findGroupContext(groupId, [actorUserId]);
    if (!context || !context.memberIds.has(actorUserId)) throw new NotFoundError("Group not found");
    return context;
  }

  private replay(stored: { fingerprint: string; response: unknown }, requestFingerprint: string): ExpenseResponse {
    if (stored.fingerprint !== requestFingerprint) {
      throw new ConflictError("Idempotency key was already used for a different request", "IDEMPOTENCY_KEY_REUSED");
    }
    const parsed = ExpenseResponseSchema.safeParse(stored.response);
    if (!parsed.success) throw new ExpenseStorageInvariantError("Stored idempotency response is invalid");
    return parsed.data;
  }
}

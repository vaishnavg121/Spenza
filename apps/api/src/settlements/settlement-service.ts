import { createHash } from "node:crypto";
import {
  BalanceResponseSchema,
  SettlementResponseSchema,
  type BalanceResponse,
  type CreateSettlementInput,
  type SettlementPage,
  type SettlementResponse,
} from "@spenza/contracts";
import { ConflictError, NotFoundError, UnprocessableEntityError, ValidationError } from "../errors/app-error.js";
import { currencyExponent } from "../expenses/money.js";
import { deriveBalances, simplifyBalances } from "./balance-engine.js";
import {
  SettlementAlreadyReversedError,
  SettlementConcurrentWriteError,
  SettlementIdempotencyRaceError,
  SettlementStorageInvariantError,
  type GroupLedger,
  type SettlementDataAccess,
  type SettlementIdempotencyScope,
  type SettlementRecord,
  type SettlementRepository,
} from "./settlement-repository.js";

export type SettlementWriteResult = { settlement: SettlementResponse; replayed: boolean };

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("Fingerprint contains an unsafe number");
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

function fingerprint(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

export function serializeSettlement(record: SettlementRecord): SettlementResponse {
  return SettlementResponseSchema.parse({
    id: record.id,
    groupId: record.groupId,
    payerId: record.payerId,
    receiverId: record.receiverId,
    amountMinor: record.amountMinor.toString(),
    currency: record.currency,
    method: record.method,
    kind: record.kind,
    status: record.status,
    reversesId: record.reversesId,
    createdById: record.createdById,
    date: record.date.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (!decoded || encodeCursor(decoded) !== cursor) throw new ValidationError("Invalid settlement cursor");
  return decoded;
}

export class SettlementService {
  constructor(private readonly repository: SettlementRepository) {}

  async getBalances(actorUserId: string, groupId: string): Promise<BalanceResponse> {
    const ledger = await this.requireMemberLedger(this.repository, actorUserId, groupId);
    return this.serializeBalances(actorUserId, groupId, ledger);
  }

  async createSettlement(
    actorUserId: string,
    groupId: string,
    key: string,
    input: CreateSettlementInput,
    requestId: string,
  ): Promise<SettlementWriteResult> {
    const scope: SettlementIdempotencyScope = {
      actorUserId,
      method: "POST",
      route: `/v1/groups/${groupId}/settlements`,
      key,
    };
    const requestFingerprint = fingerprint(input);
    try {
      return await this.repository.withTransaction(async (transaction) => {
        const ledger = await this.requireMemberLedger(transaction, actorUserId, groupId);
        const stored = await transaction.findIdempotency(scope);
        if (stored) return { settlement: this.replay(stored, requestFingerprint), replayed: true };
        this.validateCreate(actorUserId, input, ledger);
        const balances = deriveBalances(ledger.currency, ledger.knownUserIds, ledger.expenses, ledger.settlements);
        const senderNet = balances.get(actorUserId) ?? 0n;
        const receiverNet = balances.get(input.receiverId) ?? 0n;
        const amountMinor = BigInt(input.amountMinor);
        const maximum = senderNet < 0n && receiverNet > 0n
          ? (-senderNet < receiverNet ? -senderNet : receiverNet)
          : 0n;
        if (amountMinor > maximum) {
          throw new UnprocessableEntityError(
            "Settlement exceeds the currently supported obligation",
            "OVER_SETTLEMENT",
          );
        }
        const created = await transaction.createSettlement({
          groupId,
          payerId: actorUserId,
          receiverId: input.receiverId,
          amountMinor,
          currency: input.currency,
          method: input.method,
          date: input.date ? new Date(input.date) : new Date(),
          createdById: actorUserId,
        });
        const response = serializeSettlement(created);
        await transaction.appendActivity("SETTLEMENT_MADE", response, actorUserId, requestId);
        await transaction.createIdempotency(scope, requestFingerprint, response);
        return { settlement: response, replayed: false };
      });
    } catch (error) {
      if (error instanceof SettlementIdempotencyRaceError || error instanceof SettlementConcurrentWriteError) {
        const stored = await this.repository.findIdempotency(scope);
        if (stored) {
          await this.requireMemberLedger(this.repository, actorUserId, groupId);
          return { settlement: this.replay(stored, requestFingerprint), replayed: true };
        }
        throw new ConflictError("Concurrent settlement request could not be completed", "SETTLEMENT_WRITE_CONFLICT");
      }
      throw error;
    }
  }

  async listSettlements(
    actorUserId: string,
    groupId: string,
    options: { cursor?: string; limit: number },
  ): Promise<SettlementPage> {
    await this.requireMemberLedger(this.repository, actorUserId, groupId);
    const rows = await this.repository.listSettlements(groupId, {
      cursorId: decodeCursor(options.cursor),
      take: options.limit + 1,
    });
    const hasMore = rows.length > options.limit;
    const visible = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      data: visible.map(serializeSettlement),
      page: {
        hasMore,
        nextCursor: hasMore && visible.length > 0 ? encodeCursor(visible[visible.length - 1].id) : null,
      },
    };
  }

  async getSettlement(actorUserId: string, groupId: string, settlementId: string): Promise<SettlementResponse> {
    await this.requireMemberLedger(this.repository, actorUserId, groupId);
    const settlement = await this.repository.findSettlement(groupId, settlementId);
    if (!settlement) throw new NotFoundError("Settlement not found");
    return serializeSettlement(settlement);
  }

  async reverseSettlement(
    actorUserId: string,
    groupId: string,
    settlementId: string,
    key: string,
    requestId: string,
  ): Promise<SettlementWriteResult> {
    const scope: SettlementIdempotencyScope = {
      actorUserId,
      method: "POST",
      route: `/v1/groups/${groupId}/settlements/${settlementId}/reverse`,
      key,
    };
    const requestFingerprint = fingerprint({ settlementId });
    try {
      return await this.repository.withTransaction(async (transaction) => {
        await this.requireMemberLedger(transaction, actorUserId, groupId);
        const stored = await transaction.findIdempotency(scope);
        if (stored) return { settlement: this.replay(stored, requestFingerprint), replayed: true };
        const original = await transaction.findSettlement(groupId, settlementId);
        if (!original || original.kind !== "PAYMENT" || original.payerId !== actorUserId) {
          throw new NotFoundError("Settlement not found");
        }
        if (await transaction.findReversal(groupId, settlementId)) {
          throw new ConflictError("Settlement has already been reversed", "SETTLEMENT_ALREADY_REVERSED");
        }
        const reversal = await transaction.createReversal(original, actorUserId, new Date());
        const response = serializeSettlement(reversal);
        await transaction.appendActivity("SETTLEMENT_REVERSED", response, actorUserId, requestId);
        await transaction.createIdempotency(scope, requestFingerprint, response);
        return { settlement: response, replayed: false };
      });
    } catch (error) {
      if (error instanceof SettlementAlreadyReversedError) {
        throw new ConflictError("Settlement has already been reversed", "SETTLEMENT_ALREADY_REVERSED");
      }
      if (error instanceof SettlementIdempotencyRaceError || error instanceof SettlementConcurrentWriteError) {
        const stored = await this.repository.findIdempotency(scope);
        if (stored) {
          await this.requireMemberLedger(this.repository, actorUserId, groupId);
          return { settlement: this.replay(stored, requestFingerprint), replayed: true };
        }
        throw new ConflictError("Concurrent settlement reversal could not be completed", "SETTLEMENT_WRITE_CONFLICT");
      }
      throw error;
    }
  }

  private validateCreate(actorUserId: string, input: CreateSettlementInput, ledger: GroupLedger): void {
    if (ledger.isArchived) {
      throw new UnprocessableEntityError("Archived groups cannot accept settlements", "GROUP_ARCHIVED");
    }
    if (input.receiverId === actorUserId) {
      throw new UnprocessableEntityError("Settlement parties must be different", "SAME_SETTLEMENT_PARTY");
    }
    if (!ledger.currentMemberIds.has(input.receiverId)) {
      throw new UnprocessableEntityError("Settlement receiver must be a current group member", "INVALID_RECEIVER");
    }
    if (input.currency !== ledger.currency) {
      throw new UnprocessableEntityError("Settlement currency must match the group currency", "CURRENCY_MISMATCH");
    }
    try {
      currencyExponent(input.currency);
    } catch {
      throw new UnprocessableEntityError("Settlement currency is not supported", "UNSUPPORTED_CURRENCY");
    }
  }

  private async requireMemberLedger(
    dataAccess: SettlementDataAccess,
    actorUserId: string,
    groupId: string,
  ): Promise<GroupLedger> {
    const ledger = await dataAccess.loadGroupLedger(groupId);
    if (!ledger || !ledger.currentMemberIds.has(actorUserId)) throw new NotFoundError("Group not found");
    return ledger;
  }

  private serializeBalances(actorUserId: string, groupId: string, ledger: GroupLedger): BalanceResponse {
    const balances = deriveBalances(ledger.currency, ledger.knownUserIds, ledger.expenses, ledger.settlements);
    const current = balances.get(actorUserId) ?? 0n;
    return BalanceResponseSchema.parse({
      groupId,
      currency: ledger.currency,
      currentUserId: actorUserId,
      currentUserNetMinor: current.toString(),
      youOweMinor: (current < 0n ? -current : 0n).toString(),
      youAreOwedMinor: (current > 0n ? current : 0n).toString(),
      members: [...balances.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([userId, netMinor]) => ({ userId, netMinor: netMinor.toString() })),
      suggestions: simplifyBalances(balances).map((suggestion) => ({
        senderId: suggestion.senderId,
        receiverId: suggestion.receiverId,
        amountMinor: suggestion.amountMinor.toString(),
      })),
    });
  }

  private replay(stored: { fingerprint: string; response: unknown }, requestFingerprint: string): SettlementResponse {
    if (stored.fingerprint !== requestFingerprint) {
      throw new ConflictError("Idempotency key was already used for another request", "IDEMPOTENCY_KEY_REUSED");
    }
    const parsed = SettlementResponseSchema.safeParse(stored.response);
    if (!parsed.success) throw new SettlementStorageInvariantError("Stored idempotency response is invalid");
    return parsed.data;
  }
}

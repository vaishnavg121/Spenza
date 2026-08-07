import { beforeEach, describe, expect, it } from "vitest";
import { CreateSettlementSchema, type SettlementResponse } from "@spenza/contracts";
import { NotFoundError } from "../errors/app-error.js";
import type { LedgerExpense, LedgerSettlement } from "../settlements/balance-engine.js";
import {
  type GroupLedger,
  type SettlementDataAccess,
  type SettlementIdempotencyScope,
  type SettlementRecord,
  type SettlementRepository,
  type StoredSettlementIdempotency,
} from "../settlements/settlement-repository.js";
import { SettlementService } from "../settlements/settlement-service.js";

const groupId = "group_1";
const payerId = "A";
const receiverId = "B";
const instant = new Date("2026-08-08T00:00:00.000Z");
const baseExpense: LedgerExpense = {
  currency: "INR",
  totalMinor: 5_000n,
  payments: [{ userId: receiverId, contributionMinor: 5_000n }],
  allocations: [{ userId: payerId, allocationMinor: 5_000n }],
};

type State = {
  settlements: Map<string, SettlementRecord>;
  idempotency: Map<string, StoredSettlementIdempotency>;
  activities: Array<{ action: string; settlementId: string }>;
};

function scopeKey(scope: SettlementIdempotencyScope) {
  return [scope.actorUserId, scope.method, scope.route, scope.key].join("|");
}

class FakeAccess implements SettlementDataAccess {
  constructor(
    private readonly state: State,
    private readonly members: Set<string>,
    private readonly expenses: LedgerExpense[],
    private readonly nextId: () => string,
    private readonly failActivity: () => boolean,
  ) {}

  async loadGroupLedger(id: string): Promise<GroupLedger | null> {
    if (id !== groupId) return null;
    const settlements: LedgerSettlement[] = [...this.state.settlements.values()].map((settlement) => ({
      currency: settlement.currency,
      payerId: settlement.payerId,
      receiverId: settlement.receiverId,
      amountMinor: settlement.amountMinor,
      kind: settlement.kind,
    }));
    return {
      currency: "INR",
      isArchived: false,
      currentMemberIds: new Set(this.members),
      knownUserIds: new Set(this.members),
      expenses: structuredClone(this.expenses),
      settlements,
    };
  }

  async findSettlement(id: string, settlementId: string) {
    const settlement = this.state.settlements.get(settlementId);
    return id === groupId && settlement ? structuredClone(settlement) : null;
  }

  async findReversal(id: string, originalId: string) {
    if (id !== groupId) return null;
    const reversal = [...this.state.settlements.values()].find((settlement) => settlement.reversesId === originalId);
    return reversal ? structuredClone(reversal) : null;
  }

  async listSettlements(id: string, options: { cursorId?: string; take: number }) {
    if (id !== groupId) return [];
    const rows = [...this.state.settlements.values()].sort((left, right) => right.id.localeCompare(left.id));
    const start = options.cursorId ? rows.findIndex((row) => row.id === options.cursorId) + 1 : 0;
    return structuredClone(rows.slice(start, start + options.take));
  }

  async findIdempotency(scope: SettlementIdempotencyScope) {
    return structuredClone(this.state.idempotency.get(scopeKey(scope)) ?? null);
  }

  async createSettlement(input: {
    groupId: string; payerId: string; receiverId: string; amountMinor: bigint; currency: string;
    method: SettlementRecord["method"]; date: Date; createdById: string;
  }): Promise<SettlementRecord> {
    const id = this.nextId();
    const record: SettlementRecord = {
      id,
      groupId: input.groupId,
      payerId: input.payerId,
      receiverId: input.receiverId,
      amountMinor: input.amountMinor,
      currency: input.currency,
      method: input.method,
      kind: "PAYMENT",
      status: "COMPLETED",
      reversesId: null,
      createdById: input.createdById,
      date: input.date,
      createdAt: instant,
      updatedAt: instant,
    };
    this.state.settlements.set(id, record);
    return structuredClone(record);
  }

  async createReversal(original: SettlementRecord, actorUserId: string, date: Date): Promise<SettlementRecord> {
    const id = this.nextId();
    const reversal: SettlementRecord = {
      ...original,
      id,
      kind: "REVERSAL",
      reversesId: original.id,
      createdById: actorUserId,
      date,
      createdAt: instant,
      updatedAt: instant,
    };
    this.state.settlements.set(id, reversal);
    return structuredClone(reversal);
  }

  async appendActivity(
    action: "SETTLEMENT_MADE" | "SETTLEMENT_REVERSED",
    settlement: SettlementResponse,
    _actorUserId: string,
    _requestId: string,
  ) {
    if (this.failActivity()) throw new Error("Injected activity failure");
    this.state.activities.push({ action, settlementId: settlement.id });
  }

  async createIdempotency(scope: SettlementIdempotencyScope, requestFingerprint: string, response: SettlementResponse) {
    this.state.idempotency.set(scopeKey(scope), { fingerprint: requestFingerprint, response: structuredClone(response) });
  }
}

class FakeRepository implements SettlementRepository {
  state: State = { settlements: new Map(), idempotency: new Map(), activities: [] };
  members = new Set([payerId, receiverId, "C"]);
  expenses = [baseExpense];
  createCount = 0;
  failNextActivity = false;
  private tail: Promise<void> = Promise.resolve();

  private access(state = this.state) {
    return new FakeAccess(
      state,
      this.members,
      this.expenses,
      () => `settlement_${++this.createCount}`,
      () => {
        if (!this.failNextActivity) return false;
        this.failNextActivity = false;
        return true;
      },
    );
  }

  async withTransaction<T>(work: (transaction: SettlementDataAccess) => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const predecessor = this.tail;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    const candidate = structuredClone(this.state);
    try {
      const result = await work(this.access(candidate));
      this.state = candidate;
      return result;
    } finally { release(); }
  }

  loadGroupLedger(id: string) { return this.access().loadGroupLedger(id); }
  findSettlement(id: string, settlementId: string) { return this.access().findSettlement(id, settlementId); }
  findReversal(id: string, settlementId: string) { return this.access().findReversal(id, settlementId); }
  listSettlements(id: string, options: { cursorId?: string; take: number }) { return this.access().listSettlements(id, options); }
  findIdempotency(scope: SettlementIdempotencyScope) { return this.access().findIdempotency(scope); }
  createSettlement(input: Parameters<SettlementDataAccess["createSettlement"]>[0]) { return this.access().createSettlement(input); }
  createReversal(original: SettlementRecord, actor: string, date: Date) { return this.access().createReversal(original, actor, date); }
  appendActivity(action: "SETTLEMENT_MADE" | "SETTLEMENT_REVERSED", settlement: SettlementResponse, actor: string, requestId: string) {
    return this.access().appendActivity(action, settlement, actor, requestId);
  }
  createIdempotency(scope: SettlementIdempotencyScope, requestFingerprint: string, response: SettlementResponse) {
    return this.access().createIdempotency(scope, requestFingerprint, response);
  }
}

function input(amountMinor = "2000", receiver = receiverId, currency = "INR") {
  return CreateSettlementSchema.parse({ receiverId: receiver, amountMinor, currency, method: "CASH", date: instant.toISOString() });
}

describe("SettlementService", () => {
  let repository: FakeRepository;
  let service: SettlementService;

  beforeEach(() => {
    repository = new FakeRepository();
    service = new SettlementService(repository);
  });

  it("serializes canonical balances with the documented sign convention", async () => {
    const balances = await service.getBalances(payerId, groupId);
    expect(balances.currentUserNetMinor).toBe("-5000");
    expect(balances.youOweMinor).toBe("5000");
    expect(balances.youAreOwedMinor).toBe("0");
    expect(balances.members).toEqual([
      { userId: "A", netMinor: "-5000" },
      { userId: "B", netMinor: "5000" },
      { userId: "C", netMinor: "0" },
    ]);
  });

  it("hides balance data from non-members", async () => {
    await expect(service.getBalances("outsider", groupId)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates a valid partial settlement as the authenticated sender", async () => {
    const result = await service.createSettlement(payerId, groupId, "settle-key-001", input(), "req_1");
    expect(result.settlement).toMatchObject({ payerId, receiverId, amountMinor: "2000", kind: "PAYMENT" });
    expect(repository.state.activities).toEqual([{ action: "SETTLEMENT_MADE", settlementId: result.settlement.id }]);
    expect((await service.getBalances(payerId, groupId)).currentUserNetMinor).toBe("-3000");
  });

  it("allows a full settlement", async () => {
    await service.createSettlement(payerId, groupId, "settle-key-full", input("5000"), "req_1");
    expect((await service.getBalances(payerId, groupId)).currentUserNetMinor).toBe("0");
  });

  it("rejects same-party settlement", async () => {
    await expect(service.createSettlement(payerId, groupId, "settle-key-same", input("100", payerId), "req_1"))
      .rejects.toMatchObject({ code: "SAME_SETTLEMENT_PARTY", statusCode: 422 });
  });

  it("rejects a receiver outside the group", async () => {
    await expect(service.createSettlement(payerId, groupId, "settle-key-user", input("100", "outsider"), "req_1"))
      .rejects.toMatchObject({ code: "INVALID_RECEIVER", statusCode: 422 });
  });

  it("never accepts a client-selected sender", async () => {
    const parsed = CreateSettlementSchema.safeParse({ ...input(), senderId: "C" });
    expect(parsed.success).toBe(false);
  });

  it("prevents over-settlement and payment to a non-creditor", async () => {
    await expect(service.createSettlement(payerId, groupId, "settle-key-over", input("5001"), "req_1"))
      .rejects.toMatchObject({ code: "OVER_SETTLEMENT", statusCode: 422 });
    await expect(service.createSettlement(payerId, groupId, "settle-key-wrong", input("1", "C"), "req_1"))
      .rejects.toMatchObject({ code: "OVER_SETTLEMENT", statusCode: 422 });
  });

  it("rejects incompatible currency", async () => {
    await expect(service.createSettlement(payerId, groupId, "settle-key-usd1", input("100", receiverId, "USD"), "req_1"))
      .rejects.toMatchObject({ code: "CURRENCY_MISMATCH", statusCode: 422 });
  });

  it("replays identical requests without duplicating settlement or activity", async () => {
    const first = await service.createSettlement(payerId, groupId, "settle-key-replay", input(), "req_1");
    const replay = await service.createSettlement(payerId, groupId, "settle-key-replay", input(), "req_2");
    expect(replay).toEqual({ settlement: first.settlement, replayed: true });
    expect(repository.createCount).toBe(1);
    expect(repository.state.activities).toHaveLength(1);
  });

  it("rejects idempotency-key payload mismatch", async () => {
    await service.createSettlement(payerId, groupId, "settle-key-mismatch", input(), "req_1");
    await expect(service.createSettlement(payerId, groupId, "settle-key-mismatch", input("1000"), "req_2"))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", statusCode: 409 });
  });

  it("serializes concurrent duplicates and creates once", async () => {
    const [first, second] = await Promise.all([
      service.createSettlement(payerId, groupId, "settle-key-concurrent", input(), "req_1"),
      service.createSettlement(payerId, groupId, "settle-key-concurrent", input(), "req_2"),
    ]);
    expect(first.settlement.id).toBe(second.settlement.id);
    expect(repository.createCount).toBe(1);
  });

  it("reverses once and restores the prior balance exactly", async () => {
    const payment = await service.createSettlement(payerId, groupId, "settle-key-create", input(), "req_1");
    const reversal = await service.reverseSettlement(payerId, groupId, payment.settlement.id, "settle-key-reverse", "req_2");
    expect(reversal.settlement).toMatchObject({ kind: "REVERSAL", reversesId: payment.settlement.id, amountMinor: "2000" });
    expect((await service.getBalances(payerId, groupId)).currentUserNetMinor).toBe("-5000");
    expect(repository.state.activities.map((activity) => activity.action)).toEqual(["SETTLEMENT_MADE", "SETTLEMENT_REVERSED"]);
  });

  it("rejects double reversal with another key", async () => {
    const payment = await service.createSettlement(payerId, groupId, "settle-key-c2", input(), "req_1");
    await service.reverseSettlement(payerId, groupId, payment.settlement.id, "settle-key-r1", "req_2");
    await expect(service.reverseSettlement(payerId, groupId, payment.settlement.id, "settle-key-r2", "req_3"))
      .rejects.toMatchObject({ code: "SETTLEMENT_ALREADY_REVERSED", statusCode: 409 });
  });

  it("replays an identical reversal without duplicating history", async () => {
    const payment = await service.createSettlement(payerId, groupId, "settle-key-replay-create", input(), "req_1");
    const first = await service.reverseSettlement(
      payerId,
      groupId,
      payment.settlement.id,
      "settle-key-replay-reverse",
      "req_2",
    );
    const replay = await service.reverseSettlement(
      payerId,
      groupId,
      payment.settlement.id,
      "settle-key-replay-reverse",
      "req_3",
    );

    expect(replay).toEqual({ settlement: first.settlement, replayed: true });
    expect(repository.state.settlements.size).toBe(2);
    expect(repository.state.activities.map((activity) => activity.action)).toEqual([
      "SETTLEMENT_MADE",
      "SETTLEMENT_REVERSED",
    ]);
  });

  it("rejects reversal by someone other than the original sender", async () => {
    const payment = await service.createSettlement(payerId, groupId, "settle-key-own", input(), "req_1");
    await expect(service.reverseSettlement(receiverId, groupId, payment.settlement.id, "settle-key-nope", "req_2"))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("does not leak a guessed settlement ID", async () => {
    await expect(service.getSettlement(payerId, groupId, "guessed")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rolls back settlement creation when activity persistence fails", async () => {
    repository.failNextActivity = true;
    await expect(service.createSettlement(payerId, groupId, "settle-key-fail", input(), "req_1"))
      .rejects.toThrow("Injected activity failure");
    expect(repository.state.settlements.size).toBe(0);
    expect(repository.state.idempotency.size).toBe(0);
  });

  it("rolls back reversal and preserves the payment when activity persistence fails", async () => {
    const payment = await service.createSettlement(payerId, groupId, "settle-key-rollback-create", input(), "req_1");
    repository.failNextActivity = true;

    await expect(
      service.reverseSettlement(
        payerId,
        groupId,
        payment.settlement.id,
        "settle-key-rollback-reverse",
        "req_2",
      ),
    ).rejects.toThrow("Injected activity failure");

    expect(repository.state.settlements.size).toBe(1);
    expect(await repository.findReversal(groupId, payment.settlement.id)).toBeNull();
    expect(repository.state.idempotency.size).toBe(1);
    expect((await service.getBalances(payerId, groupId)).currentUserNetMinor).toBe("-3000");
  });
});

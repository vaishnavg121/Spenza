import { beforeEach, describe, expect, it } from "vitest";
import { CreateExpenseSchema, type CreateExpenseInput, type ExpenseResponse, type UpdateExpenseInput } from "@spenza/contracts";
import { ConflictError, NotFoundError, UnprocessableEntityError } from "../errors/app-error.js";
import {
  type ExpenseDataAccess,
  type ExpenseRecord,
  type ExpenseRepository,
  type ExpenseWriteData,
  type GroupExpenseContext,
  type IdempotencyScope,
  type StoredIdempotency,
} from "../expenses/expense-repository.js";
import { ExpenseService } from "../expenses/expense-service.js";

type TestState = {
  expenses: Map<string, ExpenseRecord>;
  idempotency: Map<string, StoredIdempotency>;
  revisions: ExpenseResponse[];
  activities: Array<{ action: string; expenseId: string }>;
};

const groupId = "group_1";
const actorId = "user_1";
const member2 = "user_2";
const member3 = "user_3";
const instant = new Date("2026-08-08T00:00:00.000Z");

function scopeKey(scope: IdempotencyScope): string {
  return [scope.actorUserId, scope.method, scope.route, scope.key].join("|");
}

class FakeExpenseDataAccess implements ExpenseDataAccess {
  constructor(
    private readonly state: TestState,
    private readonly groups: Map<string, { currency: string; isArchived: boolean; memberIds: Set<string> }>,
    private readonly nextId: () => string,
    private readonly shouldFailRevision: () => boolean,
  ) {}

  async findGroupContext(id: string, relevantUserIds: string[]): Promise<GroupExpenseContext | null> {
    const group = this.groups.get(id);
    if (!group) return null;
    return {
      currency: group.currency,
      isArchived: group.isArchived,
      memberIds: new Set(relevantUserIds.filter((userId) => group.memberIds.has(userId))),
    };
  }

  async categoryExists(categoryId: string): Promise<boolean> {
    return categoryId === "category_1";
  }

  async findExpenseById(targetGroupId: string, expenseId: string): Promise<ExpenseRecord | null> {
    const expense = this.state.expenses.get(expenseId);
    return expense?.groupId === targetGroupId ? structuredClone(expense) : null;
  }

  async listGroupExpenses(
    targetGroupId: string,
    options: { cursorId?: string; take: number },
  ): Promise<ExpenseRecord[]> {
    const ordered = [...this.state.expenses.values()]
      .filter((expense) => expense.groupId === targetGroupId)
      .sort((left, right) => right.date.getTime() - left.date.getTime() || right.id.localeCompare(left.id));
    const start = options.cursorId ? ordered.findIndex((expense) => expense.id === options.cursorId) + 1 : 0;
    return structuredClone(ordered.slice(start, start + options.take));
  }

  async findIdempotency(scope: IdempotencyScope): Promise<StoredIdempotency | null> {
    return structuredClone(this.state.idempotency.get(scopeKey(scope)) ?? null);
  }

  async createExpense(targetGroupId: string, creatorId: string, data: ExpenseWriteData): Promise<ExpenseRecord> {
    const id = this.nextId();
    const expense: ExpenseRecord = {
      id,
      groupId: targetGroupId,
      creatorId,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      totalMinor: data.totalMinor,
      currency: data.currency,
      splitType: data.splitType,
      version: 1,
      date: data.date,
      createdAt: instant,
      updatedAt: instant,
      payments: structuredClone(data.payments),
      allocations: structuredClone(data.allocations),
    };
    this.state.expenses.set(id, expense);
    return structuredClone(expense);
  }

  async replaceExpenseIfVersion(
    targetGroupId: string,
    expenseId: string,
    expectedVersion: number,
    data: ExpenseWriteData,
  ): Promise<ExpenseRecord | null> {
    const current = this.state.expenses.get(expenseId);
    if (!current || current.groupId !== targetGroupId || current.version !== expectedVersion) return null;
    const updated: ExpenseRecord = {
      ...current,
      title: data.title,
      description: data.description,
      categoryId: data.categoryId,
      totalMinor: data.totalMinor,
      splitType: data.splitType,
      date: data.date,
      version: current.version + 1,
      updatedAt: new Date(current.updatedAt.getTime() + 1_000),
      payments: structuredClone(data.payments),
      allocations: structuredClone(data.allocations),
    };
    this.state.expenses.set(expenseId, updated);
    return structuredClone(updated);
  }

  async appendRevision(expense: ExpenseResponse, _actorUserId: string): Promise<void> {
    if (this.shouldFailRevision()) throw new Error("Injected revision failure");
    this.state.revisions.push(structuredClone(expense));
  }

  async appendActivity(
    action: "EXPENSE_ADDED" | "EXPENSE_UPDATED",
    expense: ExpenseResponse,
    _actorUserId: string,
    _requestId: string,
  ): Promise<void> {
    this.state.activities.push({ action, expenseId: expense.id });
  }

  async createIdempotency(
    scope: IdempotencyScope,
    requestFingerprint: string,
    statusCode: number,
    response: ExpenseResponse,
  ): Promise<void> {
    this.state.idempotency.set(scopeKey(scope), {
      fingerprint: requestFingerprint,
      statusCode,
      response: structuredClone(response),
    });
  }
}

class FakeExpenseRepository implements ExpenseRepository {
  state: TestState = { expenses: new Map(), idempotency: new Map(), revisions: [], activities: [] };
  readonly groups = new Map([
    [groupId, { currency: "INR", isArchived: false, memberIds: new Set([actorId, member2, member3]) }],
  ]);
  createCount = 0;
  failNextRevision = false;
  private transactionTail: Promise<void> = Promise.resolve();

  private access(state = this.state): FakeExpenseDataAccess {
    return new FakeExpenseDataAccess(
      state,
      this.groups,
      () => {
        this.createCount += 1;
        return `expense_${this.createCount}`;
      },
      () => {
        if (!this.failNextRevision) return false;
        this.failNextRevision = false;
        return true;
      },
    );
  }

  async withTransaction<T>(work: (transaction: ExpenseDataAccess) => Promise<T>): Promise<T> {
    let release: () => void = () => {};
    const predecessor = this.transactionTail;
    this.transactionTail = new Promise<void>((resolve) => { release = resolve; });
    await predecessor;
    const candidate = structuredClone(this.state);
    try {
      const result = await work(this.access(candidate));
      this.state = candidate;
      return result;
    } finally {
      release();
    }
  }

  findGroupContext(id: string, users: string[]) { return this.access().findGroupContext(id, users); }
  categoryExists(categoryId: string) { return this.access().categoryExists(categoryId); }
  findExpenseById(id: string, expenseId: string) { return this.access().findExpenseById(id, expenseId); }
  listGroupExpenses(id: string, options: { cursorId?: string; take: number }) {
    return this.access().listGroupExpenses(id, options);
  }
  findIdempotency(scope: IdempotencyScope) { return this.access().findIdempotency(scope); }
  createExpense(id: string, creatorId: string, data: ExpenseWriteData) {
    return this.access().createExpense(id, creatorId, data);
  }
  replaceExpenseIfVersion(id: string, expenseId: string, version: number, data: ExpenseWriteData) {
    return this.access().replaceExpenseIfVersion(id, expenseId, version, data);
  }
  appendRevision(expense: ExpenseResponse, actorUserId: string) {
    return this.access().appendRevision(expense, actorUserId);
  }
  appendActivity(
    action: "EXPENSE_ADDED" | "EXPENSE_UPDATED",
    expense: ExpenseResponse,
    actorUserId: string,
    requestId: string,
  ) {
    return this.access().appendActivity(action, expense, actorUserId, requestId);
  }
  createIdempotency(scope: IdempotencyScope, requestFingerprint: string, statusCode: number, response: ExpenseResponse) {
    return this.access().createIdempotency(scope, requestFingerprint, statusCode, response);
  }
}

function expenseInput(overrides: Partial<CreateExpenseInput> = {}): CreateExpenseInput {
  return CreateExpenseSchema.parse({
    title: "Dinner",
    description: "Team dinner",
    totalMinor: "100",
    currency: "INR",
    date: instant.toISOString(),
    payers: [{ userId: actorId, amountMinor: "100" }],
    split: { type: "EQUAL", participants: [{ userId: actorId }, { userId: member2 }, { userId: member3 }] },
    ...overrides,
  });
}

describe("ExpenseService", () => {
  let repository: FakeExpenseRepository;
  let service: ExpenseService;

  beforeEach(() => {
    repository = new FakeExpenseRepository();
    service = new ExpenseService(repository);
  });

  it.each([
    ["equal", expenseInput(), ["34", "33", "33"]],
    ["exact", expenseInput({ split: { type: "EXACT", participants: [
      { userId: actorId, amountMinor: "25" }, { userId: member2, amountMinor: "75" },
    ] } }), ["25", "75"]],
    ["percentage", expenseInput({ split: { type: "PERCENTAGE", participants: [
      { userId: actorId, percentageBps: 3333 }, { userId: member2, percentageBps: 6667 },
    ] } }), ["33", "67"]],
    ["shares", expenseInput({ split: { type: "SHARES", participants: [
      { userId: actorId, shares: 1 }, { userId: member2, shares: 2 }, { userId: member3, shares: 1 },
    ] } }), ["25", "50", "25"]],
  ])("creates a valid %s expense using server allocations", async (_name, input, expected) => {
    const result = await service.createExpense(actorId, groupId, `key-${_name}-1234`, input, "req_1");
    expect(result.expense.allocations.map((allocation) => allocation.allocationMinor)).toEqual(expected);
    expect(result.expense.version).toBe(1);
    expect(repository.state.revisions).toHaveLength(1);
    expect(repository.state.activities).toEqual([{ action: "EXPENSE_ADDED", expenseId: result.expense.id }]);
  });

  it("supports multiple payers whose contributions reconcile", async () => {
    const result = await service.createExpense(actorId, groupId, "key-multi-1234", expenseInput({
      payers: [
        { userId: actorId, amountMinor: "60" },
        { userId: member2, amountMinor: "40" },
      ],
    }), "req_1");
    expect(result.expense.payers.map((payer) => payer.contributionMinor)).toEqual(["60", "40"]);
  });

  it("hides the group from a non-member actor", async () => {
    await expect(service.createExpense("outsider", groupId, "key-outsider-1", expenseInput(), "req_1"))
      .rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a payer who is not a group member", async () => {
    await expect(service.createExpense(actorId, groupId, "key-payer-1234", expenseInput({
      payers: [{ userId: "outsider", amountMinor: "100" }],
    }), "req_1")).rejects.toMatchObject({ code: "INVALID_PAYER", statusCode: 422 });
  });

  it("rejects a participant who is not a group member", async () => {
    await expect(service.createExpense(actorId, groupId, "key-participant-1", expenseInput({
      split: { type: "EQUAL", participants: [{ userId: actorId }, { userId: "outsider" }] },
    }), "req_1")).rejects.toMatchObject({ code: "INVALID_PARTICIPANT", statusCode: 422 });
  });

  it("rejects payer contributions that do not equal the total", async () => {
    await expect(service.createExpense(actorId, groupId, "key-mismatch-123", expenseInput({
      payers: [{ userId: actorId, amountMinor: "99" }],
    }), "req_1")).rejects.toMatchObject({ code: "PAYER_TOTAL_MISMATCH", statusCode: 422 });
  });

  it("replays the same idempotent request without another expense", async () => {
    const input = expenseInput();
    const first = await service.createExpense(actorId, groupId, "key-replay-1234", input, "req_1");
    const replay = await service.createExpense(actorId, groupId, "key-replay-1234", input, "req_2");
    expect(replay).toEqual({ expense: first.expense, replayed: true });
    expect(repository.createCount).toBe(1);
    expect(repository.state.revisions).toHaveLength(1);
  });

  it("rejects reuse of an idempotency key with a different payload", async () => {
    await service.createExpense(actorId, groupId, "key-conflict-123", expenseInput(), "req_1");
    await expect(service.createExpense(actorId, groupId, "key-conflict-123", expenseInput({ title: "Lunch" }), "req_2"))
      .rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED", statusCode: 409 });
  });

  it("serializes concurrent duplicate submissions and creates once", async () => {
    const input = expenseInput();
    const [first, second] = await Promise.all([
      service.createExpense(actorId, groupId, "key-concurrent-1", input, "req_1"),
      service.createExpense(actorId, groupId, "key-concurrent-1", input, "req_2"),
    ]);
    expect(first.expense.id).toBe(second.expense.id);
    expect([first.replayed, second.replayed].sort()).toEqual([false, true]);
    expect(repository.createCount).toBe(1);
  });

  it("allows a member to list and read expenses with bounded pagination", async () => {
    const created = await service.createExpense(actorId, groupId, "key-read-12345", expenseInput(), "req_1");
    const page = await service.listExpenses(member2, groupId, { limit: 20 });
    expect(page.data).toEqual([created.expense]);
    expect(page.page).toEqual({ hasMore: false, nextCursor: null });
    await expect(service.getExpense(member2, groupId, created.expense.id)).resolves.toEqual(created.expense);
  });

  it("uses opaque cursors without duplicating list rows", async () => {
    await service.createExpense(actorId, groupId, "key-page-one-1", expenseInput({ title: "First" }), "req_1");
    await service.createExpense(actorId, groupId, "key-page-two-2", expenseInput({ title: "Second" }), "req_2");
    const firstPage = await service.listExpenses(actorId, groupId, { limit: 1 });
    expect(firstPage.page.hasMore).toBe(true);
    expect(firstPage.page.nextCursor).not.toBeNull();
    const secondPage = await service.listExpenses(actorId, groupId, {
      cursor: firstPage.page.nextCursor ?? undefined,
      limit: 1,
    });
    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.data[0].id).not.toBe(firstPage.data[0].id);
  });

  it("rejects non-member reads without leaking expense existence", async () => {
    const created = await service.createExpense(actorId, groupId, "key-private-123", expenseInput(), "req_1");
    await expect(service.getExpense("outsider", groupId, created.expense.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getExpense(actorId, groupId, "guessed_expense")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a non-member update without leaking expense existence", async () => {
    const created = await service.createExpense(actorId, groupId, "key-private-up-1", expenseInput(), "req_1");
    await expect(service.updateExpense("outsider", groupId, created.expense.id, {
      expectedVersion: 1,
      title: "Unauthorized",
    }, "req_2")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("updates atomically, increments the version, recalculates splits, and appends audit", async () => {
    const created = await service.createExpense(actorId, groupId, "key-update-1234", expenseInput(), "req_1");
    const update: UpdateExpenseInput = {
      expectedVersion: 1,
      title: "Updated dinner",
      totalMinor: "90",
      payers: [{ userId: actorId, amountMinor: "90" }],
      split: { type: "EQUAL", participants: [{ userId: actorId }, { userId: member2 }] },
    };
    const updated = await service.updateExpense(actorId, groupId, created.expense.id, update, "req_2");
    expect(updated.version).toBe(2);
    expect(updated.allocations.map((allocation) => allocation.allocationMinor)).toEqual(["45", "45"]);
    expect(repository.state.revisions.map((revision) => revision.version)).toEqual([1, 2]);
    expect(repository.state.activities.map((activity) => activity.action)).toEqual(["EXPENSE_ADDED", "EXPENSE_UPDATED"]);
  });

  it("rejects a stale update without overwriting", async () => {
    const created = await service.createExpense(actorId, groupId, "key-stale-12345", expenseInput(), "req_1");
    await service.updateExpense(actorId, groupId, created.expense.id, { expectedVersion: 1, title: "First edit" }, "req_2");
    await expect(service.updateExpense(actorId, groupId, created.expense.id, { expectedVersion: 1, title: "Stale edit" }, "req_3"))
      .rejects.toMatchObject({ code: "VERSION_CONFLICT", statusCode: 409 });
    expect((await repository.findExpenseById(groupId, created.expense.id))?.title).toBe("First edit");
  });

  it("rolls back an update if audit persistence fails", async () => {
    const created = await service.createExpense(actorId, groupId, "key-rollback-123", expenseInput(), "req_1");
    repository.failNextRevision = true;
    await expect(service.updateExpense(actorId, groupId, created.expense.id, { expectedVersion: 1, title: "Must roll back" }, "req_2"))
      .rejects.toThrow("Injected revision failure");
    const stored = await repository.findExpenseById(groupId, created.expense.id);
    expect(stored?.version).toBe(1);
    expect(stored?.title).toBe("Dinner");
    expect(repository.state.revisions).toHaveLength(1);
  });

  it("uses stable domain errors for invalid archived-group writes", async () => {
    repository.groups.get(groupId)!.isArchived = true;
    await expect(service.createExpense(actorId, groupId, "key-archive-123", expenseInput(), "req_1"))
      .rejects.toBeInstanceOf(UnprocessableEntityError);
  });

  it("returns ConflictError instances for financial concurrency failures", async () => {
    const created = await service.createExpense(actorId, groupId, "key-conflict-v1", expenseInput(), "req_1");
    await expect(service.updateExpense(actorId, groupId, created.expense.id, { expectedVersion: 999 }, "req_2"))
      .rejects.toBeInstanceOf(ConflictError);
  });
});

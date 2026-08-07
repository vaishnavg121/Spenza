import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExpenseResponse } from "@spenza/contracts";
import { NotFoundError } from "../errors/app-error.js";
import { errorHandler } from "../middleware/error-handler.js";
import { createExpenseRouter, type ExpenseRouteService } from "../routes/expenses.js";

const expense: ExpenseResponse = {
  id: "expense_1",
  groupId: "group_1",
  creatorId: "user_1",
  title: "Dinner",
  description: null,
  categoryId: null,
  totalMinor: "100",
  currency: "INR",
  splitType: "EQUAL",
  version: 1,
  date: "2026-08-08T00:00:00.000Z",
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
  payers: [{ userId: "user_1", contributionMinor: "100", order: 0 }],
  allocations: [
    { userId: "user_1", allocationMinor: "50", order: 0 },
    { userId: "user_2", allocationMinor: "50", order: 1 },
  ],
};

const createExpense = vi.fn<ExpenseRouteService["createExpense"]>();
const listExpenses = vi.fn<ExpenseRouteService["listExpenses"]>();
const getExpense = vi.fn<ExpenseRouteService["getExpense"]>();
const updateExpense = vi.fn<ExpenseRouteService["updateExpense"]>();
const service: ExpenseRouteService = { createExpense, listExpenses, getExpense, updateExpense };

function testApp(authenticated = true) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.id = "req_test";
    if (authenticated) req.actor = { clerkSubject: "clerk_1" };
    next();
  });
  app.use(createExpenseRouter(service, async () => "user_1"));
  app.use(errorHandler);
  return app;
}

function createBody() {
  return {
    title: "Dinner",
    totalMinor: "100",
    currency: "INR",
    payers: [{ userId: "user_1", amountMinor: "100" }],
    split: { type: "EQUAL", participants: [{ userId: "user_1" }, { userId: "user_2" }] },
  };
}

describe("Expense API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated expense request", async () => {
    const response = await request(testApp(false)).get("/v1/groups/group_1/expenses");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("creates an expense with a required idempotency key", async () => {
    createExpense.mockResolvedValue({ expense, replayed: false });
    const response = await request(testApp())
      .post("/v1/groups/group_1/expenses")
      .set("Idempotency-Key", "expense-create-001")
      .send(createBody());
    expect(response.status).toBe(201);
    expect(response.headers.location).toBe("/v1/groups/group_1/expenses/expense_1");
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(createExpense).toHaveBeenCalledWith(
      "user_1",
      "group_1",
      "expense-create-001",
      createBody(),
      "req_test",
    );
  });

  it("marks a successful idempotent replay", async () => {
    createExpense.mockResolvedValue({ expense, replayed: true });
    const response = await request(testApp())
      .post("/v1/groups/group_1/expenses")
      .set("Idempotency-Key", "expense-create-001")
      .send(createBody());
    expect(response.status).toBe(201);
    expect(response.headers["x-idempotent-replay"]).toBe("true");
  });

  it("requires the idempotency header before service execution", async () => {
    const response = await request(testApp()).post("/v1/groups/group_1/expenses").send(createBody());
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(createExpense).not.toHaveBeenCalled();
  });

  it("rejects malformed minor-unit money", async () => {
    const response = await request(testApp())
      .post("/v1/groups/group_1/expenses")
      .set("Idempotency-Key", "expense-create-002")
      .send({ ...createBody(), totalMinor: 12.34 });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_FAILED");
    expect(createExpense).not.toHaveBeenCalled();
  });

  it("lists expenses with validated pagination", async () => {
    listExpenses.mockResolvedValue({ data: [expense], page: { hasMore: false, nextCursor: null } });
    const response = await request(testApp()).get("/v1/groups/group_1/expenses?limit=10");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([expense]);
    expect(listExpenses).toHaveBeenCalledWith("user_1", "group_1", { limit: 10 });
  });

  it("reads an authorized expense", async () => {
    getExpense.mockResolvedValue(expense);
    const response = await request(testApp()).get("/v1/groups/group_1/expenses/expense_1");
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expense);
    expect(getExpense).toHaveBeenCalledWith("user_1", "group_1", "expense_1");
  });

  it("preserves a hidden not-found response for inaccessible expenses", async () => {
    getExpense.mockRejectedValue(new NotFoundError("Expense not found"));
    const response = await request(testApp()).get("/v1/groups/group_1/expenses/guessed");
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("updates an expense through the versioned contract", async () => {
    updateExpense.mockResolvedValue({ ...expense, title: "Updated", version: 2 });
    const response = await request(testApp())
      .patch("/v1/groups/group_1/expenses/expense_1")
      .send({ expectedVersion: 1, title: "Updated" });
    expect(response.status).toBe(200);
    expect(response.body.data.version).toBe(2);
    expect(updateExpense).toHaveBeenCalledWith(
      "user_1",
      "group_1",
      "expense_1",
      { expectedVersion: 1, title: "Updated" },
      "req_test",
    );
  });

  it("rejects unknown update fields", async () => {
    const response = await request(testApp())
      .patch("/v1/groups/group_1/expenses/expense_1")
      .send({ expectedVersion: 1, creatorId: "attacker" });
    expect(response.status).toBe(400);
    expect(updateExpense).not.toHaveBeenCalled();
  });
});

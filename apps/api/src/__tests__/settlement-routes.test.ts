import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BalanceResponse, SettlementResponse } from "@spenza/contracts";
import { ConflictError, NotFoundError } from "../errors/app-error.js";
import { errorHandler } from "../middleware/error-handler.js";
import { createSettlementRouter, type SettlementRouteService } from "../routes/settlements.js";

const settlement: SettlementResponse = {
  id: "settlement_1",
  groupId: "group_1",
  payerId: "A",
  receiverId: "B",
  amountMinor: "2000",
  currency: "INR",
  method: "CASH",
  kind: "PAYMENT",
  status: "COMPLETED",
  reversesId: null,
  createdById: "A",
  date: "2026-08-08T00:00:00.000Z",
  createdAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
};
const balances: BalanceResponse = {
  groupId: "group_1",
  currency: "INR",
  currentUserId: "A",
  currentUserNetMinor: "-5000",
  youOweMinor: "5000",
  youAreOwedMinor: "0",
  members: [{ userId: "A", netMinor: "-5000" }, { userId: "B", netMinor: "5000" }],
  suggestions: [{ senderId: "A", receiverId: "B", amountMinor: "5000" }],
};

const getBalances = vi.fn<SettlementRouteService["getBalances"]>();
const createSettlement = vi.fn<SettlementRouteService["createSettlement"]>();
const listSettlements = vi.fn<SettlementRouteService["listSettlements"]>();
const getSettlement = vi.fn<SettlementRouteService["getSettlement"]>();
const reverseSettlement = vi.fn<SettlementRouteService["reverseSettlement"]>();
const service: SettlementRouteService = { getBalances, createSettlement, listSettlements, getSettlement, reverseSettlement };

function app(authenticated = true) {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.id = "req_test";
    if (authenticated) req.actor = { clerkSubject: "clerk_A" };
    next();
  });
  instance.use(createSettlementRouter(service, async () => "A"));
  instance.use(errorHandler);
  return instance;
}

describe("balance and settlement routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires authentication for balances", async () => {
    const response = await request(app(false)).get("/v1/groups/group_1/balances");
    expect(response.status).toBe(401);
  });

  it("returns canonical balances", async () => {
    getBalances.mockResolvedValue(balances);
    const response = await request(app()).get("/v1/groups/group_1/balances");
    expect(response.status).toBe(200);
    expect(response.body.data.currentUserNetMinor).toBe("-5000");
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });

  it("creates settlement with required idempotency key", async () => {
    createSettlement.mockResolvedValue({ settlement, replayed: false });
    const response = await request(app())
      .post("/v1/groups/group_1/settlements")
      .set("Idempotency-Key", "settlement-key-001")
      .send({ receiverId: "B", amountMinor: "2000", currency: "INR", method: "CASH" });
    expect(response.status).toBe(201);
    expect(response.headers.location).toContain("settlement_1");
    expect(createSettlement).toHaveBeenCalledWith("A", "group_1", "settlement-key-001", {
      receiverId: "B", amountMinor: "2000", currency: "INR", method: "CASH",
    }, "req_test");
  });

  it("rejects a missing idempotency key", async () => {
    const response = await request(app()).post("/v1/groups/group_1/settlements")
      .send({ receiverId: "B", amountMinor: "2000", currency: "INR" });
    expect(response.status).toBe(400);
    expect(createSettlement).not.toHaveBeenCalled();
  });

  it.each(["0", "-1", "12.34", 2000])("rejects malformed amount %s", async (amountMinor) => {
    const response = await request(app()).post("/v1/groups/group_1/settlements")
      .set("Idempotency-Key", "settlement-key-bad")
      .send({ receiverId: "B", amountMinor, currency: "INR" });
    expect(response.status).toBe(400);
    expect(createSettlement).not.toHaveBeenCalled();
  });

  it("rejects a client-selected sender", async () => {
    const response = await request(app()).post("/v1/groups/group_1/settlements")
      .set("Idempotency-Key", "settlement-key-sender")
      .send({ senderId: "C", receiverId: "B", amountMinor: "100", currency: "INR" });
    expect(response.status).toBe(400);
  });

  it("lists and reads settlements", async () => {
    listSettlements.mockResolvedValue({ data: [settlement], page: { hasMore: false, nextCursor: null } });
    getSettlement.mockResolvedValue(settlement);
    expect((await request(app()).get("/v1/groups/group_1/settlements?limit=10")).status).toBe(200);
    expect((await request(app()).get("/v1/groups/group_1/settlements/settlement_1")).body.data).toEqual(settlement);
  });

  it("does not leak inaccessible settlement IDs", async () => {
    getSettlement.mockRejectedValue(new NotFoundError("Settlement not found"));
    const response = await request(app()).get("/v1/groups/group_1/settlements/guessed");
    expect(response.status).toBe(404);
  });

  it("creates an idempotent reversal", async () => {
    reverseSettlement.mockResolvedValue({ settlement: { ...settlement, id: "reversal_1", kind: "REVERSAL", reversesId: settlement.id }, replayed: false });
    const response = await request(app()).post("/v1/groups/group_1/settlements/settlement_1/reverse")
      .set("Idempotency-Key", "settlement-reverse-1")
      .send({});
    expect(response.status).toBe(201);
    expect(response.body.data.kind).toBe("REVERSAL");
  });

  it("returns stable conflict envelopes", async () => {
    reverseSettlement.mockRejectedValue(new ConflictError("Already reversed", "SETTLEMENT_ALREADY_REVERSED"));
    const response = await request(app()).post("/v1/groups/group_1/settlements/settlement_1/reverse")
      .set("Idempotency-Key", "settlement-reverse-2")
      .send({});
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("SETTLEMENT_ALREADY_REVERSED");
  });
});

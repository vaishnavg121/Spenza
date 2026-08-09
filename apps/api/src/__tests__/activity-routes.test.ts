import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createActivityRouter } from "../routes/activity.js";
import { ActivityService } from "../activity/activity-service.js";
import { ActivityPage } from "@spenza/contracts";
import { errorHandler } from "../middleware/error-handler.js";

const mockActivityPage: ActivityPage = {
  data: [
    {
      id: "act_2",
      userId: "user_1",
      groupId: "group_1",
      expenseId: "exp_1",
      settlementId: null,
      action: "EXPENSE_ADDED",
      details: { title: "Dinner", totalMinor: "10000" },
      createdAt: "2026-08-08T12:00:00.000Z",
      user: { id: "user_1", name: "Alice", image: null },
      group: { id: "group_1", name: "Trip" },
    },
    {
      id: "act_1",
      userId: "user_1",
      groupId: "group_1",
      expenseId: null,
      settlementId: "set_1",
      action: "SETTLEMENT_REVERSED",
      details: { amountMinor: "2000" },
      createdAt: "2026-08-08T10:00:00.000Z",
      user: { id: "user_1", name: "Alice", image: null },
      group: { id: "group_1", name: "Trip" },
    },
  ],
  page: {
    nextCursor: null,
    hasMore: false,
  },
};

function buildApp(authenticated = true, listActivitiesMock = vi.fn()) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.id = "req_test";
    if (authenticated) {
      req.actor = { clerkSubject: "clerk_user_1" };
    }
    next();
  });

  const mockService = {
    listActivities: listActivitiesMock,
  } as unknown as ActivityService;

  app.use(createActivityRouter(mockService, async () => "user_1"));
  app.use(errorHandler);
  return app;
}

describe("GET /v1/activity", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp(false);
    const response = await request(app).get("/v1/activity");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns paginated activity data for authenticated user", async () => {
    const listActivities = vi.fn().mockResolvedValue(mockActivityPage);
    const app = buildApp(true, listActivities);

    const response = await request(app).get("/v1/activity");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toEqual({ data: mockActivityPage });
    expect(listActivities).toHaveBeenCalledWith("user_1", { limit: 20 });
  });

  it("passes cursor and limit query parameters", async () => {
    const listActivities = vi.fn().mockResolvedValue(mockActivityPage);
    const app = buildApp(true, listActivities);

    const response = await request(app).get("/v1/activity?cursor=act_1&limit=10");

    expect(response.status).toBe(200);
    expect(listActivities).toHaveBeenCalledWith("user_1", { cursor: "act_1", limit: 10 });
  });
});

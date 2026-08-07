import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createAnalyticsRouter } from "../routes/analytics.js";
import { AnalyticsService } from "../analytics/analytics-service.js";
import { AnalyticsResponse } from "@spenza/contracts";
import { errorHandler } from "../middleware/error-handler.js";

const mockAnalyticsResponse: AnalyticsResponse = {
  personalSpendingMinor: "3000",
  totalContributedMinor: "10000",
  totalGroupExpensesMinor: "10000",
  currency: "USD",
  categoryBreakdown: [],
  monthlyTrends: [],
  groupBreakdown: [],
};

function buildApp(authenticated = true, getAnalyticsMock = vi.fn()) {
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
    getAnalytics: getAnalyticsMock,
  } as unknown as AnalyticsService;

  app.use(createAnalyticsRouter(mockService, async () => "user_1"));
  app.use(errorHandler);
  return app;
}

describe("GET /v1/analytics", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp(false);
    const response = await request(app).get("/v1/analytics");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns analytics data for authenticated user", async () => {
    const getAnalytics = vi.fn().mockResolvedValue(mockAnalyticsResponse);
    const app = buildApp(true, getAnalytics);

    const response = await request(app).get("/v1/analytics");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.data).toEqual(mockAnalyticsResponse);
    expect(getAnalytics).toHaveBeenCalledWith("user_1", {});
  });
});

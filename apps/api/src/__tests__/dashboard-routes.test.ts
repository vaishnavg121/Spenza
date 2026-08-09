import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createDashboardRouter } from "../routes/dashboard.js";
import { DashboardService } from "../dashboard/dashboard-service.js";
import { DashboardResponse } from "@spenza/contracts";
import { errorHandler } from "../middleware/error-handler.js";

const mockDashboardResponse: DashboardResponse = {
  currencySummaries: [{
    totalOwedMinor: "5000",
    totalOwingMinor: "2000",
    netBalanceMinor: "3000",
    currency: "USD",
    spendingChart: [
      { month: "Mar", spendingMinor: "1000" },
      { month: "Apr", spendingMinor: "2000" },
    ],
  }],
  recentExpenses: [],
  recentSettlements: [],
  recentActivities: [],
};

function buildApp(authenticated = true, getDashboardDataMock = vi.fn()) {
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
    getDashboardData: getDashboardDataMock,
  } as unknown as DashboardService;

  app.use(createDashboardRouter(mockService, async () => "user_1"));
  app.use(errorHandler);
  return app;
}

describe("GET /v1/dashboard", () => {
  it("returns 401 when request is unauthenticated", async () => {
    const app = buildApp(false);
    const response = await request(app).get("/v1/dashboard");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns dashboard data for authenticated user", async () => {
    const getDashboardData = vi.fn().mockResolvedValue(mockDashboardResponse);
    const app = buildApp(true, getDashboardData);

    const response = await request(app).get("/v1/dashboard");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body.data).toEqual(mockDashboardResponse);
    expect(getDashboardData).toHaveBeenCalledWith("user_1");
  });
});

import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSearchRouter } from "../routes/search.js";
import { SearchService } from "../search/search-service.js";
import { ExpenseSearchPage } from "@spenza/contracts";
import { errorHandler } from "../middleware/error-handler.js";

const mockSearchPage: ExpenseSearchPage = {
  data: [],
  page: { nextCursor: null, hasMore: false },
};

function buildApp(authenticated = true, searchExpensesMock = vi.fn()) {
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
    searchExpenses: searchExpensesMock,
  } as unknown as SearchService;

  app.use(createSearchRouter(mockService, async () => "user_1"));
  app.use(errorHandler);
  return app;
}

describe("GET /v1/search/expenses", () => {
  it("returns 401 when unauthenticated", async () => {
    const app = buildApp(false);
    const response = await request(app).get("/v1/search/expenses");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns search results for authenticated user", async () => {
    const searchExpenses = vi.fn().mockResolvedValue(mockSearchPage);
    const app = buildApp(true, searchExpenses);

    const response = await request(app).get("/v1/search/expenses?q=Dinner");

    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
    expect(response.body).toEqual({ data: mockSearchPage });
    expect(searchExpenses).toHaveBeenCalledWith("user_1", { q: "Dinner", limit: 20 });
  });
});

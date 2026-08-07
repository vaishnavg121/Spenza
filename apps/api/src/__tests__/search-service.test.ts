import { describe, expect, it } from "vitest";
import { SearchService } from "../search/search-service.js";
import { SearchRepository } from "../search/search-repository.js";
import { ExpenseRecord } from "../expenses/expense-repository.js";
import { ExpenseSearchQuery } from "@spenza/contracts";

class InMemorySearchRepository implements SearchRepository {
  public userGroupIds: string[] = ["group_1"];
  public expenses: ExpenseRecord[] = [];

  async findUserGroupIds(_userId: string): Promise<string[]> {
    return this.userGroupIds;
  }

  async searchExpenses(
    _userId: string,
    authorizedGroupIds: string[],
    query: ExpenseSearchQuery,
    _cursorId?: string
  ): Promise<ExpenseRecord[]> {
    if (query.groupId && !authorizedGroupIds.includes(query.groupId)) {
      return [];
    }

    let results = this.expenses.filter((e) => authorizedGroupIds.includes(e.groupId));

    if (query.q) {
      const qLower = query.q.toLowerCase();
      results = results.filter(
        (e) =>
          e.title.toLowerCase().includes(qLower) ||
          (e.description && e.description.toLowerCase().includes(qLower))
      );
    }

    if (query.minAmountMinor) {
      const min = BigInt(query.minAmountMinor);
      results = results.filter((e) => e.totalMinor >= min);
    }

    if (query.maxAmountMinor) {
      const max = BigInt(query.maxAmountMinor);
      results = results.filter((e) => e.totalMinor <= max);
    }

    return results;
  }
}

const mockExpense: ExpenseRecord = {
  id: "exp_1",
  groupId: "group_1",
  creatorId: "user_1",
  title: "Dinner Pizza",
  description: "Pizza night",
  categoryId: "cat_food",
  totalMinor: 5000n,
  currency: "USD",
  splitType: "EQUAL",
  version: 1,
  date: new Date("2026-08-08"),
  createdAt: new Date("2026-08-08"),
  updatedAt: new Date("2026-08-08"),
  payments: [{ userId: "user_1", contributionMinor: 5000n, order: 0 }],
  allocations: [
    { userId: "user_1", allocationMinor: 2500n, order: 0, percentageBps: null, shareWeight: null },
    { userId: "user_2", allocationMinor: 2500n, order: 1, percentageBps: null, shareWeight: null },
  ],
};

describe("SearchService", () => {
  it("returns authorized expenses matching search query", async () => {
    const repository = new InMemorySearchRepository();
    repository.expenses = [mockExpense];
    const service = new SearchService(repository);

    const result = await service.searchExpenses("user_1", { q: "Pizza", limit: 20 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe("Dinner Pizza");
  });

  it("hides expenses from unauthorized groups when filtering", async () => {
    const repository = new InMemorySearchRepository();
    repository.userGroupIds = ["group_1"];
    repository.expenses = [mockExpense];
    const service = new SearchService(repository);

    const result = await service.searchExpenses("user_1", { groupId: "secret_group", limit: 20 });

    expect(result.data).toHaveLength(0);
  });

  it("filters expenses by amount bounds", async () => {
    const repository = new InMemorySearchRepository();
    repository.expenses = [mockExpense];
    const service = new SearchService(repository);

    const match = await service.searchExpenses("user_1", {
      minAmountMinor: "4000",
      maxAmountMinor: "6000",
      limit: 20,
    });
    expect(match.data).toHaveLength(1);

    const noMatch = await service.searchExpenses("user_1", {
      minAmountMinor: "6000",
      limit: 20,
    });
    expect(noMatch.data).toHaveLength(0);
  });
});

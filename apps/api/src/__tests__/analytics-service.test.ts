import { describe, expect, it } from "vitest";
import { AnalyticsService } from "../analytics/analytics-service.js";
import {
  AnalyticsCurrencyMismatchError,
  AnalyticsRepository,
  RawAnalyticsData,
} from "../analytics/analytics-repository.js";
import { AnalyticsQuery } from "@spenza/contracts";

class InMemoryAnalyticsRepository implements AnalyticsRepository {
  public userGroupIds: string[] = ["group_1"];
  public data: RawAnalyticsData = {
    personalSpendingMinor: 3000n,
    totalContributedMinor: 10000n,
    totalGroupExpensesMinor: 10000n,
    currency: "USD",
    categoryBreakdown: [
      {
        categoryId: "cat_food",
        categoryName: "Food",
        icon: null,
        color: null,
        totalMinor: 3000n,
      },
    ],
    monthlyTrends: [
      {
        month: "Aug",
        personalSpendingMinor: 3000n,
        groupTotalMinor: 10000n,
      },
    ],
    groupBreakdown: [
      {
        groupId: "group_1",
        groupName: "Trip",
        personalSpendingMinor: 3000n,
        totalExpensesMinor: 10000n,
      },
    ],
  };
  public error: Error | null = null;

  async findUserGroupIds(_userId: string): Promise<string[]> {
    return this.userGroupIds;
  }

  async getAnalyticsData(
    _userId: string,
    authorizedGroupIds: string[],
    query: AnalyticsQuery
  ): Promise<RawAnalyticsData> {
    if (this.error) throw this.error;
    if (query.groupId && !authorizedGroupIds.includes(query.groupId)) {
      return {
        personalSpendingMinor: 0n,
        totalContributedMinor: 0n,
        totalGroupExpensesMinor: 0n,
        currency: "USD",
        categoryBreakdown: [],
        monthlyTrends: [],
        groupBreakdown: [],
      };
    }
    return this.data;
  }
}

describe("AnalyticsService", () => {
  it("distinguishes personal spending (allocations) from total contributed (payments)", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const service = new AnalyticsService(repository);

    const result = await service.getAnalytics("user_1", {});

    expect(result.personalSpendingMinor).toBe("3000");
    expect(result.totalContributedMinor).toBe("10000");
    expect(result.totalGroupExpensesMinor).toBe("10000");
    expect(result.currency).toBe("USD");
  });

  it("calculates percentage basis points for category breakdown", async () => {
    const repository = new InMemoryAnalyticsRepository();
    const service = new AnalyticsService(repository);

    const result = await service.getAnalytics("user_1", {});

    expect(result.categoryBreakdown).toHaveLength(1);
    expect(result.categoryBreakdown[0].categoryName).toBe("Food");
    expect(result.categoryBreakdown[0].percentageBps).toBe(10000); // 100% = 10000 bps
  });

  it("returns empty analytics when filtering by unauthorized group", async () => {
    const repository = new InMemoryAnalyticsRepository();
    repository.userGroupIds = ["group_1"];
    const service = new AnalyticsService(repository);

    const result = await service.getAnalytics("user_1", { groupId: "unauthorized_group" });

    expect(result.personalSpendingMinor).toBe("0");
    expect(result.totalContributedMinor).toBe("0");
    expect(result.categoryBreakdown).toHaveLength(0);
  });

  it("fails closed when analytics would combine different currencies", async () => {
    const repository = new InMemoryAnalyticsRepository();
    repository.error = new AnalyticsCurrencyMismatchError();
    const service = new AnalyticsService(repository);

    await expect(service.getAnalytics("user_1", {})).rejects.toMatchObject({
      statusCode: 422,
      code: "CURRENCY_MISMATCH",
    });
  });
});

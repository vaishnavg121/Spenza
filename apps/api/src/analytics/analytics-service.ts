import {
  AnalyticsResponseSchema,
  type AnalyticsQuery,
  type AnalyticsResponse,
} from "@spenza/contracts";
import { UnprocessableEntityError } from "../errors/app-error.js";
import {
  AnalyticsCurrencyMismatchError,
  type AnalyticsRepository,
  type RawAnalyticsData,
} from "./analytics-repository.js";

export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getAnalytics(actorUserId: string, query: AnalyticsQuery): Promise<AnalyticsResponse> {
    const authorizedGroupIds = await this.repository.findUserGroupIds(actorUserId);
    let raw: RawAnalyticsData;
    try {
      raw = await this.repository.getAnalyticsData(actorUserId, authorizedGroupIds, query);
    } catch (error) {
      if (error instanceof AnalyticsCurrencyMismatchError) {
        throw new UnprocessableEntityError(
          "Analytics cannot combine groups with different currencies",
          "CURRENCY_MISMATCH",
        );
      }
      throw error;
    }

    const categoryBreakdown = raw.categoryBreakdown.map((cat) => {
      const percentageBps = raw.personalSpendingMinor > 0n
        ? Number((cat.totalMinor * 10000n) / raw.personalSpendingMinor)
        : 0;
      return {
        categoryId: cat.categoryId,
        categoryName: cat.categoryName,
        icon: cat.icon,
        color: cat.color,
        totalMinor: cat.totalMinor.toString(),
        percentageBps: Math.min(Math.max(percentageBps, 0), 10000),
      };
    });

    return AnalyticsResponseSchema.parse({
      personalSpendingMinor: raw.personalSpendingMinor.toString(),
      totalContributedMinor: raw.totalContributedMinor.toString(),
      totalGroupExpensesMinor: raw.totalGroupExpensesMinor.toString(),
      currency: raw.currency,
      categoryBreakdown,
      monthlyTrends: raw.monthlyTrends.map((trend) => ({
        month: trend.month,
        personalSpendingMinor: trend.personalSpendingMinor.toString(),
        groupTotalMinor: trend.groupTotalMinor.toString(),
      })),
      groupBreakdown: raw.groupBreakdown.map((g) => ({
        groupId: g.groupId,
        groupName: g.groupName,
        personalSpendingMinor: g.personalSpendingMinor.toString(),
        totalExpensesMinor: g.totalExpensesMinor.toString(),
      })),
    });
  }
}

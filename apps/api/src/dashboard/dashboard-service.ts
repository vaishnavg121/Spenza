import {
  DashboardResponseSchema,
  type DashboardResponse,
} from "@spenza/contracts";
import { deriveBalances } from "../settlements/balance-engine.js";
import { serializeExpense } from "../expenses/expense-service.js";
import { serializeSettlement } from "../settlements/settlement-service.js";
import { serializeActivity } from "../activity/activity-service.js";
import { type DashboardRepository } from "./dashboard-repository.js";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getDashboardData(actorUserId: string): Promise<DashboardResponse> {
    const groups = await this.repository.findUserGroups(actorUserId);
    const groupIds = groups.map((g) => g.id);

    const summaries = new Map<string, {
      groupIds: string[];
      totalOwedMinor: bigint;
      totalOwingMinor: bigint;
    }>();

    if (groupIds.length > 0) {
      const ledgers = await this.repository.loadGroupLedgers(groupIds);
      for (const ledger of ledgers) {
        const balances = deriveBalances(ledger.currency, ledger.knownUserIds, ledger.expenses, ledger.settlements);
        const netMinor = balances.get(actorUserId) ?? 0n;
        const summary = summaries.get(ledger.currency) ?? {
          groupIds: [],
          totalOwedMinor: 0n,
          totalOwingMinor: 0n,
        };
        summary.groupIds.push(ledger.groupId);
        if (netMinor > 0n) {
          summary.totalOwedMinor += netMinor;
        } else if (netMinor < 0n) {
          summary.totalOwingMinor += -netMinor;
        }
        summaries.set(ledger.currency, summary);
      }
    }

    const currencySummaries = await Promise.all(
      [...summaries.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(async ([currency, summary]) => {
          const spendingChart = await this.repository.findMonthlySpending(actorUserId, summary.groupIds);
          return {
            currency,
            totalOwedMinor: summary.totalOwedMinor.toString(),
            totalOwingMinor: summary.totalOwingMinor.toString(),
            netBalanceMinor: (summary.totalOwedMinor - summary.totalOwingMinor).toString(),
            spendingChart: spendingChart.map((item) => ({
              month: item.month,
              spendingMinor: item.spendingMinor.toString(),
            })),
          };
        }),
    );

    const recentExpenses = groupIds.length > 0
      ? await this.repository.findRecentExpenses(groupIds, 5)
      : [];
    const recentSettlements = groupIds.length > 0
      ? await this.repository.findRecentSettlements(groupIds, 5)
      : [];
    const recentActivities = await this.repository.findRecentActivities(actorUserId, groupIds, 10);
    return DashboardResponseSchema.parse({
      currencySummaries,
      recentExpenses: recentExpenses.map(serializeExpense),
      recentSettlements: recentSettlements.map(serializeSettlement),
      recentActivities: recentActivities.map(serializeActivity),
    });
  }
}

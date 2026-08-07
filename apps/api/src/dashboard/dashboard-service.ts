import {
  DashboardResponseSchema,
  type DashboardResponse,
} from "@spenza/contracts";
import { UnprocessableEntityError } from "../errors/app-error.js";
import { deriveBalances } from "../settlements/balance-engine.js";
import { serializeExpense } from "../expenses/expense-service.js";
import { serializeSettlement } from "../settlements/settlement-service.js";
import { serializeActivity } from "../activity/activity-service.js";
import { type DashboardRepository } from "./dashboard-repository.js";

const LAUNCH_CURRENCY = "USD";

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getDashboardData(actorUserId: string): Promise<DashboardResponse> {
    const groups = await this.repository.findUserGroups(actorUserId);
    const groupIds = groups.map((g) => g.id);

    let totalOwedMinor = 0n;
    let totalOwingMinor = 0n;

    if (groupIds.length > 0) {
      const ledgers = await this.repository.loadGroupLedgers(groupIds);
      for (const ledger of ledgers) {
        if (ledger.currency !== LAUNCH_CURRENCY) {
          throw new UnprocessableEntityError("Mixed currencies across groups are not supported", "CURRENCY_MISMATCH");
        }
        const balances = deriveBalances(ledger.currency, ledger.knownUserIds, ledger.expenses, ledger.settlements);
        const netMinor = balances.get(actorUserId) ?? 0n;
        if (netMinor > 0n) {
          totalOwedMinor += netMinor;
        } else if (netMinor < 0n) {
          totalOwingMinor += -netMinor;
        }
      }
    }

    const netBalanceMinor = totalOwedMinor - totalOwingMinor;

    const recentExpenses = groupIds.length > 0
      ? await this.repository.findRecentExpenses(groupIds, 5)
      : [];
    const recentSettlements = groupIds.length > 0
      ? await this.repository.findRecentSettlements(groupIds, 5)
      : [];
    const recentActivities = await this.repository.findRecentActivities(actorUserId, groupIds, 10);
    const spendingChart = await this.repository.findMonthlySpending(actorUserId, groupIds);

    return DashboardResponseSchema.parse({
      balances: {
        totalOwedMinor: totalOwedMinor.toString(),
        totalOwingMinor: totalOwingMinor.toString(),
        netBalanceMinor: netBalanceMinor.toString(),
        currency: LAUNCH_CURRENCY,
      },
      recentExpenses: recentExpenses.map(serializeExpense),
      recentSettlements: recentSettlements.map(serializeSettlement),
      recentActivities: recentActivities.map(serializeActivity),
      spendingChart: spendingChart.map((s) => ({
        month: s.month,
        spendingMinor: s.spendingMinor.toString(),
      })),
    });
  }
}

import { describe, expect, it } from "vitest";
import { DashboardService } from "../dashboard/dashboard-service.js";
import {
  type DashboardGroup,
  type DashboardGroupLedger,
  type DashboardRepository,
  type MonthlySpending,
} from "../dashboard/dashboard-repository.js";
import { ExpenseRecord } from "../expenses/expense-repository.js";
import { SettlementRecord } from "../settlements/settlement-repository.js";
import { ActivityRecord } from "../activity/activity-repository.js";
import { UnprocessableEntityError } from "../errors/app-error.js";

class InMemoryDashboardRepository implements DashboardRepository {
  public groups: DashboardGroup[] = [];
  public ledgers = new Map<string, DashboardGroupLedger>();
  public expenses: ExpenseRecord[] = [];
  public settlements: SettlementRecord[] = [];
  public activities: ActivityRecord[] = [];
  public monthlySpending: MonthlySpending[] = [];

  async findUserGroups(_userId: string): Promise<DashboardGroup[]> {
    return this.groups;
  }

  async loadGroupLedgers(groupIds: string[]): Promise<DashboardGroupLedger[]> {
    return groupIds.map((id) => this.ledgers.get(id)!).filter(Boolean);
  }

  async findRecentExpenses(_groupIds: string[], limit: number): Promise<ExpenseRecord[]> {
    return this.expenses.slice(0, limit);
  }

  async findRecentSettlements(_groupIds: string[], limit: number): Promise<SettlementRecord[]> {
    return this.settlements.slice(0, limit);
  }

  async findRecentActivities(_userId: string, _groupIds: string[], limit: number): Promise<ActivityRecord[]> {
    return this.activities.slice(0, limit);
  }

  async findMonthlySpending(_userId: string, _groupIds: string[]): Promise<MonthlySpending[]> {
    return this.monthlySpending;
  }
}

describe("DashboardService", () => {
  it("returns zero metrics and empty lists for a user with no groups or activity", async () => {
    const repository = new InMemoryDashboardRepository();
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.balances).toEqual({
      totalOwedMinor: "0",
      totalOwingMinor: "0",
      netBalanceMinor: "0",
      currency: "USD",
    });
    expect(result.recentExpenses).toEqual([]);
    expect(result.recentSettlements).toEqual([]);
    expect(result.recentActivities).toEqual([]);
  });

  it("calculates correct metrics for an owed-only user", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [{ id: "group_1", name: "Trip", currency: "USD" }];
    repository.ledgers.set("group_1", {
      groupId: "group_1",
      currency: "USD",
      knownUserIds: new Set(["user_1", "user_2"]),
      expenses: [
        {
          currency: "USD",
          totalMinor: 10000n,
          payments: [{ userId: "user_1", contributionMinor: 10000n }],
          allocations: [
            { userId: "user_1", allocationMinor: 5000n },
            { userId: "user_2", allocationMinor: 5000n },
          ],
        },
      ],
      settlements: [],
    });
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.balances.totalOwedMinor).toBe("5000");
    expect(result.balances.totalOwingMinor).toBe("0");
    expect(result.balances.netBalanceMinor).toBe("5000");
    expect(
      BigInt(result.balances.totalOwedMinor) - BigInt(result.balances.totalOwingMinor)
    ).toBe(BigInt(result.balances.netBalanceMinor));
  });

  it("calculates correct metrics for an owes-only user", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [{ id: "group_1", name: "Trip", currency: "USD" }];
    repository.ledgers.set("group_1", {
      groupId: "group_1",
      currency: "USD",
      knownUserIds: new Set(["user_1", "user_2"]),
      expenses: [
        {
          currency: "USD",
          totalMinor: 10000n,
          payments: [{ userId: "user_2", contributionMinor: 10000n }],
          allocations: [
            { userId: "user_1", allocationMinor: 3000n },
            { userId: "user_2", allocationMinor: 7000n },
          ],
        },
      ],
      settlements: [],
    });
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.balances.totalOwedMinor).toBe("0");
    expect(result.balances.totalOwingMinor).toBe("3000");
    expect(result.balances.netBalanceMinor).toBe("-3000");
    expect(
      BigInt(result.balances.totalOwedMinor) - BigInt(result.balances.totalOwingMinor)
    ).toBe(BigInt(result.balances.netBalanceMinor));
  });

  it("calculates mixed position and maintains net balance invariant across multiple groups", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [
      { id: "group_1", name: "House", currency: "USD" },
      { id: "group_2", name: "Vacation", currency: "USD" },
    ];
    // Group 1: user_1 lent $50 (5000 minor)
    repository.ledgers.set("group_1", {
      groupId: "group_1",
      currency: "USD",
      knownUserIds: new Set(["user_1", "user_2"]),
      expenses: [
        {
          currency: "USD",
          totalMinor: 10000n,
          payments: [{ userId: "user_1", contributionMinor: 10000n }],
          allocations: [
            { userId: "user_1", allocationMinor: 5000n },
            { userId: "user_2", allocationMinor: 5000n },
          ],
        },
      ],
      settlements: [],
    });
    // Group 2: user_1 owes $20 (2000 minor)
    repository.ledgers.set("group_2", {
      groupId: "group_2",
      currency: "USD",
      knownUserIds: new Set(["user_1", "user_3"]),
      expenses: [
        {
          currency: "USD",
          totalMinor: 4000n,
          payments: [{ userId: "user_3", contributionMinor: 4000n }],
          allocations: [
            { userId: "user_1", allocationMinor: 2000n },
            { userId: "user_3", allocationMinor: 2000n },
          ],
        },
      ],
      settlements: [],
    });
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.balances.totalOwedMinor).toBe("5000");
    expect(result.balances.totalOwingMinor).toBe("2000");
    expect(result.balances.netBalanceMinor).toBe("3000");
    expect(
      BigInt(result.balances.totalOwedMinor) - BigInt(result.balances.totalOwingMinor)
    ).toBe(BigInt(result.balances.netBalanceMinor));
  });

  it("rejects groups with incompatible currencies", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [{ id: "group_eur", name: "Europe", currency: "EUR" }];
    repository.ledgers.set("group_eur", {
      groupId: "group_eur",
      currency: "EUR",
      knownUserIds: new Set(["user_1", "user_2"]),
      expenses: [],
      settlements: [],
    });
    const service = new DashboardService(repository);

    await expect(service.getDashboardData("user_1")).rejects.toThrow(UnprocessableEntityError);
  });
});

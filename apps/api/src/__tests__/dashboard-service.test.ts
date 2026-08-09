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

class InMemoryDashboardRepository implements DashboardRepository {
  public groups: DashboardGroup[] = [];
  public ledgers = new Map<string, DashboardGroupLedger>();
  public expenses: ExpenseRecord[] = [];
  public settlements: SettlementRecord[] = [];
  public activities: ActivityRecord[] = [];
  public monthlySpending: MonthlySpending[] = [];
  public monthlySpendingCalls: string[][] = [];

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

  async findMonthlySpending(_userId: string, groupIds: string[]): Promise<MonthlySpending[]> {
    this.monthlySpendingCalls.push(groupIds);
    return this.monthlySpending;
  }
}

describe("DashboardService", () => {
  it("returns zero metrics and empty lists for a user with no groups or activity", async () => {
    const repository = new InMemoryDashboardRepository();
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.currencySummaries).toEqual([]);
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

    const summary = result.currencySummaries[0];
    expect(summary.totalOwedMinor).toBe("5000");
    expect(summary.totalOwingMinor).toBe("0");
    expect(summary.netBalanceMinor).toBe("5000");
    expect(
      BigInt(summary.totalOwedMinor) - BigInt(summary.totalOwingMinor)
    ).toBe(BigInt(summary.netBalanceMinor));
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

    const summary = result.currencySummaries[0];
    expect(summary.totalOwedMinor).toBe("0");
    expect(summary.totalOwingMinor).toBe("3000");
    expect(summary.netBalanceMinor).toBe("-3000");
    expect(
      BigInt(summary.totalOwedMinor) - BigInt(summary.totalOwingMinor)
    ).toBe(BigInt(summary.netBalanceMinor));
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

    const summary = result.currencySummaries[0];
    expect(summary.totalOwedMinor).toBe("5000");
    expect(summary.totalOwingMinor).toBe("2000");
    expect(summary.netBalanceMinor).toBe("3000");
    expect(
      BigInt(summary.totalOwedMinor) - BigInt(summary.totalOwingMinor)
    ).toBe(BigInt(summary.netBalanceMinor));
  });

  it("supports a non-USD single-currency group", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [{ id: "group_inr", name: "Home", currency: "INR" }];
    repository.ledgers.set("group_inr", {
      groupId: "group_inr",
      currency: "INR",
      knownUserIds: new Set(["user_1", "user_2"]),
      expenses: [],
      settlements: [],
    });
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.currencySummaries).toEqual([
      {
        currency: "INR",
        totalOwedMinor: "0",
        totalOwingMinor: "0",
        netBalanceMinor: "0",
        spendingChart: [],
      },
    ]);
  });

  it("keeps unlike currencies in independent summaries", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [
      { id: "group_usd", name: "Work", currency: "USD" },
      { id: "group_inr", name: "Home", currency: "INR" },
    ];
    repository.ledgers.set("group_usd", {
      groupId: "group_usd",
      currency: "USD",
      knownUserIds: new Set(["user_1", "user_2"]),
      expenses: [{
        currency: "USD",
        totalMinor: 10000n,
        payments: [{ userId: "user_1", contributionMinor: 10000n }],
        allocations: [
          { userId: "user_1", allocationMinor: 5000n },
          { userId: "user_2", allocationMinor: 5000n },
        ],
      }],
      settlements: [],
    });
    repository.ledgers.set("group_inr", {
      groupId: "group_inr",
      currency: "INR",
      knownUserIds: new Set(["user_1", "user_3"]),
      expenses: [{
        currency: "INR",
        totalMinor: 4000n,
        payments: [{ userId: "user_3", contributionMinor: 4000n }],
        allocations: [
          { userId: "user_1", allocationMinor: 2000n },
          { userId: "user_3", allocationMinor: 2000n },
        ],
      }],
      settlements: [],
    });
    const service = new DashboardService(repository);

    const result = await service.getDashboardData("user_1");

    expect(result.currencySummaries).toEqual([
      expect.objectContaining({ currency: "INR", netBalanceMinor: "-2000" }),
      expect.objectContaining({ currency: "USD", netBalanceMinor: "5000" }),
    ]);
    expect(repository.monthlySpendingCalls).toEqual([["group_inr"], ["group_usd"]]);
  });

  it("reports 39 INR outstanding after an 11 INR payment against a 50 INR debt", async () => {
    const repository = new InMemoryDashboardRepository();
    repository.groups = [{ id: "group_inr", name: "Home", currency: "INR" }];
    repository.ledgers.set("group_inr", {
      groupId: "group_inr",
      currency: "INR",
      knownUserIds: new Set(["A", "B"]),
      expenses: [{
        currency: "INR",
        totalMinor: 10_000n,
        payments: [{ userId: "A", contributionMinor: 10_000n }],
        allocations: [{ userId: "A", allocationMinor: 5_000n }, { userId: "B", allocationMinor: 5_000n }],
      }],
      settlements: [{ currency: "INR", payerId: "B", receiverId: "A", amountMinor: 1_100n, kind: "PAYMENT" }],
    });
    const result = await new DashboardService(repository).getDashboardData("A");
    expect(result.currencySummaries[0]).toMatchObject({
      currency: "INR",
      totalOwedMinor: "3900",
      totalOwingMinor: "0",
      netBalanceMinor: "3900",
    });
  });
});

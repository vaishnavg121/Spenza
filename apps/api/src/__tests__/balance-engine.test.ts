import { describe, expect, it } from "vitest";
import { BalanceInvariantError, deriveBalances, simplifyBalances, type LedgerExpense } from "../settlements/balance-engine.js";

const users = ["A", "B", "C"];

function expense(
  totalMinor: bigint,
  payments: Array<[string, bigint]>,
  allocations: Array<[string, bigint]>,
): LedgerExpense {
  return {
    currency: "INR",
    totalMinor,
    payments: payments.map(([userId, contributionMinor]) => ({ userId, contributionMinor })),
    allocations: allocations.map(([userId, allocationMinor]) => ({ userId, allocationMinor })),
  };
}

function values(balances: Map<string, bigint>) {
  return Object.fromEntries(balances);
}

describe("balance engine", () => {
  it("derives a simple equal expense", () => {
    expect(values(deriveBalances("INR", users, [expense(100n, [["A", 100n]], [["A", 34n], ["B", 33n], ["C", 33n]])], [])))
      .toEqual({ A: 66n, B: -33n, C: -33n });
  });

  it("derives exact allocations", () => {
    expect(values(deriveBalances("INR", users, [expense(120n, [["A", 120n]], [["A", 50n], ["B", 40n], ["C", 30n]])], [])))
      .toEqual({ A: 70n, B: -40n, C: -30n });
  });

  it("derives percentage allocations already rounded by the expense engine", () => {
    expect(values(deriveBalances("INR", users, [expense(101n, [["B", 101n]], [["A", 51n], ["B", 30n], ["C", 20n]])], [])))
      .toEqual({ A: -51n, B: 71n, C: -20n });
  });

  it("derives share allocations already rounded by the expense engine", () => {
    expect(values(deriveBalances("INR", users, [expense(100n, [["C", 100n]], [["A", 25n], ["B", 50n], ["C", 25n]])], [])))
      .toEqual({ A: -25n, B: -50n, C: 75n });
  });

  it("supports multiple payers exactly", () => {
    const balances = deriveBalances("INR", users, [expense(
      10_000n,
      [["A", 7_000n], ["B", 3_000n]],
      [["A", 2_500n], ["B", 2_500n], ["C", 5_000n]],
    )], []);
    expect(values(balances)).toEqual({ A: 4_500n, B: 500n, C: -5_000n });
  });

  it("combines multiple expenses while remaining zero-sum", () => {
    const balances = deriveBalances("INR", users, [
      expense(90n, [["A", 90n]], [["A", 30n], ["B", 30n], ["C", 30n]]),
      expense(60n, [["B", 60n]], [["A", 20n], ["B", 20n], ["C", 20n]]),
    ], []);
    expect(values(balances)).toEqual({ A: 40n, B: 10n, C: -50n });
    expect([...balances.values()].reduce((sum, value) => sum + value, 0n)).toBe(0n);
  });

  it("handles a payer who is also a participant", () => {
    const balances = deriveBalances("INR", ["A", "B"], [expense(50n, [["A", 50n]], [["A", 20n], ["B", 30n]])], []);
    expect(values(balances)).toEqual({ A: 30n, B: -30n });
  });

  it("applies partial and full settlement effects with the documented signs", () => {
    const base = expense(50n, [["B", 50n]], [["A", 50n]]);
    const partial = deriveBalances("INR", ["A", "B"], [base], [{
      currency: "INR", payerId: "A", receiverId: "B", amountMinor: 20n, kind: "PAYMENT",
    }]);
    expect(values(partial)).toEqual({ A: -30n, B: 30n });
    const full = deriveBalances("INR", ["A", "B"], [base], [{
      currency: "INR", payerId: "A", receiverId: "B", amountMinor: 50n, kind: "PAYMENT",
    }]);
    expect(values(full)).toEqual({ A: 0n, B: 0n });
  });

  it("keeps a 50 INR debt, an 11 INR payment, and the 39 INR remainder semantically distinct", () => {
    const bill = expense(10_000n, [["A", 10_000n]], [["A", 5_000n], ["B", 5_000n]]);
    const afterPartialPayment = deriveBalances("INR", ["A", "B"], [bill], [{
      currency: "INR", payerId: "B", receiverId: "A", amountMinor: 1_100n, kind: "PAYMENT",
    }]);
    expect(values(afterPartialPayment)).toEqual({ A: 3_900n, B: -3_900n });

    const afterFullPayment = deriveBalances("INR", ["A", "B"], [bill], [{
      currency: "INR", payerId: "B", receiverId: "A", amountMinor: 5_000n, kind: "PAYMENT",
    }]);
    expect(values(afterFullPayment)).toEqual({ A: 0n, B: 0n });

    const afterReversal = deriveBalances("INR", ["A", "B"], [bill], [
      { currency: "INR", payerId: "B", receiverId: "A", amountMinor: 1_100n, kind: "PAYMENT" },
      { currency: "INR", payerId: "B", receiverId: "A", amountMinor: 1_100n, kind: "REVERSAL" },
    ]);
    expect(values(afterReversal)).toEqual({ A: 5_000n, B: -5_000n });
  });

  it("restores balances to zero when a voided expense is excluded from the active ledger", () => {
    const activeExpense = expense(10_000n, [["A", 10_000n]], [["A", 5_000n], ["B", 5_000n]]);
    expect(values(deriveBalances("INR", ["A", "B"], [activeExpense], []))).toEqual({ A: 5_000n, B: -5_000n });
    expect(values(deriveBalances("INR", ["A", "B"], [], []))).toEqual({ A: 0n, B: 0n });
  });

  it("applies a reversal as the exact inverse", () => {
    const balances = deriveBalances("INR", ["A", "B"], [expense(50n, [["B", 50n]], [["A", 50n]])], [
      { currency: "INR", payerId: "A", receiverId: "B", amountMinor: 20n, kind: "PAYMENT" },
      { currency: "INR", payerId: "A", receiverId: "B", amountMinor: 20n, kind: "REVERSAL" },
    ]);
    expect(values(balances)).toEqual({ A: -50n, B: 50n });
  });

  it("rejects incompatible currencies", () => {
    expect(() => deriveBalances("INR", users, [{ ...expense(10n, [["A", 10n]], [["B", 10n]]), currency: "USD" }], []))
      .toThrowError(BalanceInvariantError);
  });

  it("rejects unreconciled source records", () => {
    expect(() => deriveBalances("INR", users, [expense(100n, [["A", 99n]], [["B", 100n]])], []))
      .toThrowError(/does not reconcile/);
  });

  it("creates deterministic non-authoritative repayment suggestions", () => {
    const balances = new Map<string, bigint>([["A", -5_000n], ["B", 3_000n], ["C", 2_000n]]);
    expect(simplifyBalances(balances)).toEqual([
      { senderId: "A", receiverId: "B", amountMinor: 3_000n },
      { senderId: "A", receiverId: "C", amountMinor: 2_000n },
    ]);
    expect(values(balances)).toEqual({ A: -5_000n, B: 3_000n, C: 2_000n });
  });

  it("checks zero-sum conservation over many deterministic expense inputs", () => {
    for (let total = 1n; total <= 250n; total += 1n) {
      const first = total / 3n + (total % 3n > 0n ? 1n : 0n);
      const second = total / 3n + (total % 3n > 1n ? 1n : 0n);
      const third = total - first - second;
      const balances = deriveBalances("INR", users, [expense(total, [["A", total]], [["A", first], ["B", second], ["C", third]])], []);
      expect([...balances.values()].reduce((sum, value) => sum + value, 0n)).toBe(0n);
    }
  });
});

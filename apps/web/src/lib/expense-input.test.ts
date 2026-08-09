import { describe, expect, it } from "vitest";
import {
  buildExpenseInput,
  createInitialExpenseSplits,
  type ExpenseDraft,
} from "./expense-input";

const memberIds = ["user_a", "user_b"] as const;

function draft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    title: "Dinner",
    amount: "100.00",
    payerId: "user_a",
    splitType: "EQUAL",
    splits: [
      { userId: "user_a", value: "0", isSelected: true },
      { userId: "user_b", value: "0", isSelected: true },
    ],
    ...overrides,
  };
}

describe("expense dialog input construction", () => {
  it("initializes every current group member for the dialog", () => {
    expect(createInitialExpenseSplits(memberIds, "EQUAL").map((split) => split.userId))
      .toEqual(["user_a", "user_b"]);
  });

  it("uses an internal group member ID when the payer changes", () => {
    const input = buildExpenseInput(draft({ payerId: "user_b" }), "INR", memberIds);

    expect(input.currency).toBe("INR");
    expect(input.payers).toEqual([{ userId: "user_b", amountMinor: "10000" }]);
  });

  it("collects an equal split across both selected members", () => {
    const input = buildExpenseInput(draft(), "INR", memberIds);

    expect(input.split).toEqual({
      type: "EQUAL",
      participants: [{ userId: "user_a" }, { userId: "user_b" }],
    });
  });

  it("excludes a deselected member from an equal split", () => {
    const input = buildExpenseInput(draft({
      splits: [
        { userId: "user_a", value: "0", isSelected: true },
        { userId: "user_b", value: "0", isSelected: false },
      ],
    }), "INR", memberIds);

    expect(input.split).toEqual({ type: "EQUAL", participants: [{ userId: "user_a" }] });
  });

  it("rejects an empty participant selection", () => {
    expect(() => buildExpenseInput(draft({
      splits: [
        { userId: "user_a", value: "0", isSelected: false },
        { userId: "user_b", value: "0", isSelected: false },
      ],
    }), "INR", memberIds)).toThrow("Select at least one participant");
  });

  it("validates exact amounts using integer minor units", () => {
    const valid = buildExpenseInput(draft({
      splitType: "EXACT",
      splits: [
        { userId: "user_a", value: "50.00", isSelected: true },
        { userId: "user_b", value: "50.00", isSelected: true },
      ],
    }), "INR", memberIds);

    expect(valid.split).toEqual({
      type: "EXACT",
      participants: [
        { userId: "user_a", amountMinor: "5000" },
        { userId: "user_b", amountMinor: "5000" },
      ],
    });
    expect(() => buildExpenseInput(draft({
      splitType: "EXACT",
      splits: [
        { userId: "user_a", value: "49.99", isSelected: true },
        { userId: "user_b", value: "50.00", isSelected: true },
      ],
    }), "INR", memberIds)).toThrow("Exact amounts must add up");
  });

  it("requires percentage inputs to total exactly 10000 basis points", () => {
    const valid = buildExpenseInput(draft({
      splitType: "PERCENTAGE",
      splits: [
        { userId: "user_a", value: "33.33", isSelected: true },
        { userId: "user_b", value: "66.67", isSelected: true },
      ],
    }), "INR", memberIds);

    expect(valid.split).toEqual({
      type: "PERCENTAGE",
      participants: [
        { userId: "user_a", percentageBps: 3333 },
        { userId: "user_b", percentageBps: 6667 },
      ],
    });
    expect(() => buildExpenseInput(draft({
      splitType: "PERCENTAGE",
      splits: [
        { userId: "user_a", value: "50", isSelected: true },
        { userId: "user_b", value: "49.99", isSelected: true },
      ],
    }), "INR", memberIds)).toThrow("Percentages must add up");
  });

  it("accepts only positive whole-number share weights", () => {
    const valid = buildExpenseInput(draft({
      splitType: "SHARES",
      splits: [
        { userId: "user_a", value: "3", isSelected: true },
        { userId: "user_b", value: "2", isSelected: true },
      ],
    }), "INR", memberIds);

    expect(valid.split).toEqual({
      type: "SHARES",
      participants: [
        { userId: "user_a", shares: 3 },
        { userId: "user_b", shares: 2 },
      ],
    });
    expect(() => buildExpenseInput(draft({
      splitType: "SHARES",
      splits: [{ userId: "user_a", value: "1.5", isSelected: true }],
    }), "INR", memberIds)).toThrow("Shares must be positive whole numbers");
  });

  it("rejects non-member payers and participants before calling the API", () => {
    expect(() => buildExpenseInput(draft({ payerId: "outsider" }), "INR", memberIds))
      .toThrow("payer must be a current group member");
    expect(() => buildExpenseInput(draft({
      splits: [{ userId: "outsider", value: "0", isSelected: true }],
    }), "INR", memberIds)).toThrow("participant must be a current group member");
  });
});

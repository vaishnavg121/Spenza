import { describe, expect, it } from "vitest";
import { calculateSplit, SplitValidationError, validatePayers, type SplitInput } from "../expenses/split-engine.js";

const ids = (count: number) => Array.from({ length: count }, (_, index) => ({ userId: `u${index + 1}` }));
const amounts = (total: bigint, input: SplitInput) => calculateSplit(total, input).map((row) => row.allocationMinor);
const sum = (values: bigint[]) => values.reduce((total, value) => total + value, 0n);

describe("equal splits", () => {
  it("allocates divisible totals", () => expect(amounts(99n, { type: "EQUAL", participants: ids(3) })).toEqual([33n, 33n, 33n]));
  it("uses stable order for equal remainders", () => expect(amounts(100n, { type: "EQUAL", participants: ids(3) })).toEqual([34n, 33n, 33n]));
  it("supports totals smaller than participant count", () => expect(amounts(1n, { type: "EQUAL", participants: ids(3) })).toEqual([1n, 0n, 0n]));
});

describe("exact splits", () => {
  it("accepts an exact conserved total", () => expect(amounts(100n, { type: "EXACT", participants: [{ userId: "a", amountMinor: 40n }, { userId: "b", amountMinor: 60n }] })).toEqual([40n, 60n]));
  it.each([[40n, 59n], [40n, 61n]])("rejects totals that do not reconcile", (a, b) => {
    expect(() => calculateSplit(100n, { type: "EXACT", participants: [{ userId: "a", amountMinor: a }, { userId: "b", amountMinor: b }] })).toThrowError(SplitValidationError);
  });
});

describe("percentage splits", () => {
  it("allocates exact basis points", () => expect(amounts(100n, { type: "PERCENTAGE", participants: [{ userId: "a", percentageBps: 5_000n }, { userId: "b", percentageBps: 3_000n }, { userId: "c", percentageBps: 2_000n }] })).toEqual([50n, 30n, 20n]));
  it("rounds by largest remainder then stable order", () => expect(amounts(101n, { type: "PERCENTAGE", participants: [{ userId: "a", percentageBps: 5_000n }, { userId: "b", percentageBps: 5_000n }] })).toEqual([51n, 50n]));
  it("rejects percentages not totaling 10000", () => expect(() => calculateSplit(100n, { type: "PERCENTAGE", participants: [{ userId: "a", percentageBps: 9_999n }] })).toThrowError(SplitValidationError));
});

describe("share splits", () => {
  it("supports equal weights", () => expect(amounts(100n, { type: "SHARES", participants: [{ userId: "a", shares: 1n }, { userId: "b", shares: 1n }] })).toEqual([50n, 50n]));
  it("supports unequal weights", () => expect(amounts(100n, { type: "SHARES", participants: [{ userId: "a", shares: 1n }, { userId: "b", shares: 2n }, { userId: "c", shares: 1n }] })).toEqual([25n, 50n, 25n]));
  it("rounds using fractional remainder", () => expect(amounts(100n, { type: "SHARES", participants: [{ userId: "a", shares: 3n }, { userId: "b", shares: 2n }, { userId: "c", shares: 1n }] })).toEqual([50n, 33n, 17n]));
  it.each([0n, -1n])("rejects non-positive weights", (shares) => expect(() => calculateSplit(10n, { type: "SHARES", participants: [{ userId: "a", shares }] })).toThrowError(SplitValidationError));
});

describe("general invariants", () => {
  it.each([0n, -1n])("rejects non-positive totals", (total) => expect(() => calculateSplit(total, { type: "EQUAL", participants: ids(1) })).toThrowError(SplitValidationError));
  it("rejects empty participants", () => expect(() => calculateSplit(1n, { type: "EQUAL", participants: [] })).toThrowError(SplitValidationError));
  it("rejects duplicate participants", () => expect(() => calculateSplit(1n, { type: "EQUAL", participants: [{ userId: "a" }, { userId: "a" }] })).toThrowError(SplitValidationError));
  it("is deterministic and conserves values across a broad input grid", () => {
    for (let total = 1n; total <= 250n; total += 1n) {
      for (let count = 1; count <= 12; count += 1) {
        const input = { type: "EQUAL" as const, participants: ids(count) };
        const first = calculateSplit(total, input);
        expect(calculateSplit(total, input)).toEqual(first);
        expect(sum(first.map((row) => row.allocationMinor))).toBe(total);
        expect(first.every((row) => row.allocationMinor >= 0n)).toBe(true);
      }
    }
  });
});

describe("payer invariants", () => {
  it("accepts multiple payers that reconcile", () => expect(() => validatePayers(100n, [
    { userId: "a", contributionMinor: 60n },
    { userId: "b", contributionMinor: 40n },
  ])).not.toThrow());
  it("rejects missing, duplicate, non-positive, and unreconciled payers", () => {
    expect(() => validatePayers(1n, [])).toThrowError(SplitValidationError);
    expect(() => validatePayers(2n, [{ userId: "a", contributionMinor: 1n }, { userId: "a", contributionMinor: 1n }])).toThrowError(SplitValidationError);
    expect(() => validatePayers(1n, [{ userId: "a", contributionMinor: 0n }])).toThrowError(SplitValidationError);
    expect(() => validatePayers(2n, [{ userId: "a", contributionMinor: 1n }])).toThrowError(SplitValidationError);
  });
});

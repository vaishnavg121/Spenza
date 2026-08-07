import { describe, expect, it } from "vitest";
import { currencyExponent, parseMajorAmount } from "../expenses/money.js";

describe("money utilities", () => {
  it("parses two-decimal currencies without floating point", () => {
    expect(parseMajorAmount("123.45", "INR")).toBe(12_345n);
    expect(parseMajorAmount("10.9", "USD")).toBe(1_090n);
  });
  it("rejects malformed, over-precise, and unsupported values", () => {
    for (const value of ["-1", "1.234", "1e3", " 1", "01"]) {
      expect(() => parseMajorAmount(value, "INR")).toThrow();
    }
    expect(() => currencyExponent("JPY")).toThrow();
  });
});

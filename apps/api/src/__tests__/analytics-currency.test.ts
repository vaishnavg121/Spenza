import { describe, expect, it } from "vitest";
import {
  AnalyticsCurrencyMismatchError,
  resolveAnalyticsCurrency,
} from "../analytics/analytics-repository.js";

describe("resolveAnalyticsCurrency", () => {
  it("uses the selected groups' common currency", () => {
    expect(resolveAnalyticsCurrency(["INR", "INR"])).toBe("INR");
  });

  it("rejects unlike currencies instead of summing them", () => {
    expect(() => resolveAnalyticsCurrency(["INR", "USD"]))
      .toThrow(AnalyticsCurrencyMismatchError);
  });
});

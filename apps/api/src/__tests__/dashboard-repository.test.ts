import { describe, expect, it } from "vitest";
import { resolveDashboardCurrency } from "../dashboard/dashboard-repository.js";

describe("resolveDashboardCurrency", () => {
  it("inherits the group currency for a legacy record without authoritative minor units", () => {
    expect(resolveDashboardCurrency("INR", "USD", null)).toBe("INR");
  });

  it("preserves an authoritative record currency so mismatches still fail closed", () => {
    expect(resolveDashboardCurrency("INR", "USD", 10000n)).toBe("USD");
  });
});

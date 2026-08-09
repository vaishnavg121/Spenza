import { describe, it, expect } from "vitest";
import { parseAmountToMinorUnit, formatMinorUnitCurrency, formatMinorUnitToAmount } from "./money";

describe("money utils", () => {
  describe("parseAmountToMinorUnit", () => {
    it("converts whole numbers correctly", () => {
      expect(parseAmountToMinorUnit("123")).toBe("12300");
      expect(parseAmountToMinorUnit("10")).toBe("1000");
    });

    it("converts decimals correctly", () => {
      expect(parseAmountToMinorUnit("123.45")).toBe("12345");
      expect(parseAmountToMinorUnit("0.01")).toBe("1");
      expect(parseAmountToMinorUnit("0.10")).toBe("10");
    });

    it("rejects negatives", () => {
      expect(parseAmountToMinorUnit("-123.45")).toBeNull();
    });

    it("rejects excessive fractional digits", () => {
      expect(parseAmountToMinorUnit("123.456")).toBeNull();
    });

    it("rejects malformed decimals", () => {
      expect(parseAmountToMinorUnit("123.45.6")).toBeNull();
      expect(parseAmountToMinorUnit("abc")).toBeNull();
    });
    
    it("handles zeros", () => {
        expect(parseAmountToMinorUnit("0")).toBe("0");
        expect(parseAmountToMinorUnit("0.00")).toBe("0");
    });
  });

  describe("formatMinorUnitToAmount", () => {
    it("formats minor units", () => {
      expect(formatMinorUnitToAmount("12345")).toBe("123.45");
      expect(formatMinorUnitToAmount("1")).toBe("0.01");
      expect(formatMinorUnitToAmount("1000")).toBe("10.00");
      expect(formatMinorUnitToAmount("0")).toBe("0.00");
    });
  });

  describe("formatMinorUnitCurrency", () => {
    it("uses the INR symbol for INR minor units", () => {
      expect(formatMinorUnitCurrency("12345", "INR")).toBe("₹123.45");
    });

    it("labels currencies without a configured symbol", () => {
      expect(formatMinorUnitCurrency("12345", "JPY")).toBe("JPY 123.45");
    });
  });
});

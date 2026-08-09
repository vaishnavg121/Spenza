import { describe, expect, it } from "vitest";
import type { SuggestedTransfer } from "@spenza/contracts";
import { buildSettlementInput, initialSettlementAmount } from "./settlement-input";

const suggestion: SuggestedTransfer = { senderId: "user_b", receiverId: "user_a", amountMinor: "5000" };

describe("settlement suggestion input", () => {
  it("populates the full suggested amount and authoritative receiver", () => {
    expect(initialSettlementAmount(suggestion)).toBe("50.00");
    expect(buildSettlementInput("user_b", suggestion, "50.00", "INR")).toEqual({
      receiverId: "user_a", amountMinor: "5000", currency: "INR", method: "CASH",
    });
  });

  it("supports a positive partial settlement", () => {
    expect(buildSettlementInput("user_b", suggestion, "20.00", "INR").amountMinor).toBe("2000");
  });

  it("rejects over-settlement, zero, malformed amounts, and the wrong payer", () => {
    expect(() => buildSettlementInput("user_b", suggestion, "50.01", "INR")).toThrow("cannot exceed");
    expect(() => buildSettlementInput("user_b", suggestion, "0", "INR")).toThrow("positive");
    expect(() => buildSettlementInput("user_b", suggestion, "1.001", "INR")).toThrow("positive");
    expect(() => buildSettlementInput("user_a", suggestion, "50.00", "INR")).toThrow("person who owes");
  });
});

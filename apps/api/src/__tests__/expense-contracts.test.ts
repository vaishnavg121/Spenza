import { describe, expect, it } from "vitest";
import { CreateExpenseSchema, PositiveMinorUnitStringSchema } from "@spenza/contracts";

const valid = {
  title: "Dinner",
  totalMinor: "12345",
  currency: "INR",
  payers: [{ userId: "u1", amountMinor: "12345" }],
  split: { type: "EQUAL" as const, participants: [{ userId: "u1" }, { userId: "u2" }] },
};

describe("expense contracts", () => {
  it("accepts canonical minor-unit strings", () => expect(CreateExpenseSchema.safeParse(valid).success).toBe(true));
  it.each(["12.34", "01", "0", "-1", " 12", "1e3"])("rejects non-canonical positive money %s", (value) => expect(PositiveMinorUnitStringSchema.safeParse(value).success).toBe(false));
  it("rejects unknown and client-owned identity fields", () => expect(CreateExpenseSchema.safeParse({ ...valid, creatorId: "u2" }).success).toBe(false));
});

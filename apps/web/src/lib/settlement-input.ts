import type { CreateSettlementInput, SuggestedTransfer } from "@spenza/contracts";
import { formatMinorUnitToAmount, parseAmountToMinorUnit } from "./money";

export function initialSettlementAmount(suggestion: SuggestedTransfer): string {
  return formatMinorUnitToAmount(suggestion.amountMinor);
}

export function buildSettlementInput(
  currentUserId: string,
  suggestion: SuggestedTransfer,
  amount: string,
  currency: string,
): CreateSettlementInput {
  if (currentUserId !== suggestion.senderId) {
    throw new Error("Only the person who owes this balance can record the settlement");
  }
  const amountMinor = parseAmountToMinorUnit(amount);
  if (!amountMinor || amountMinor === "0") throw new Error("Enter a positive settlement amount");
  if (BigInt(amountMinor) > BigInt(suggestion.amountMinor)) {
    throw new Error("Settlement cannot exceed the outstanding balance");
  }
  return {
    receiverId: suggestion.receiverId,
    amountMinor,
    currency,
    method: "CASH",
  };
}

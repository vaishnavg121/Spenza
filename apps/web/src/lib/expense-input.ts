import type { CreateExpenseInput, ExpenseSplitInput } from "@spenza/contracts";
import { parseAmountToMinorUnit } from "./money";

export type ExpenseDraftSplit = {
  userId: string;
  value: string;
  isSelected: boolean;
};

export type ExpenseDraft = {
  title: string;
  amount: string;
  payerId: string;
  splitType: "EQUAL" | "EXACT" | "PERCENTAGE" | "SHARES";
  splits: ExpenseDraftSplit[];
};

function formatBasisPoints(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = (basisPoints % 100).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function createInitialExpenseSplits(
  memberIds: readonly string[],
  splitType: ExpenseDraft["splitType"],
): ExpenseDraftSplit[] {
  if (splitType === "PERCENTAGE" && memberIds.length > 0) {
    const baseBasisPoints = Math.floor(10_000 / memberIds.length);
    const remainder = 10_000 - baseBasisPoints * memberIds.length;
    return memberIds.map((userId, index) => ({
      userId,
      value: formatBasisPoints(baseBasisPoints + (index === 0 ? remainder : 0)),
      isSelected: true,
    }));
  }

  return memberIds.map((userId) => ({
    userId,
    value: splitType === "SHARES" ? "1" : "0",
    isSelected: true,
  }));
}

function parsePercentageToBasisPoints(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [whole, fraction = ""] = normalized.split(".");
  const basisPoints = BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0"));
  if (basisPoints > BigInt(10_000)) return null;
  return Number(basisPoints);
}

function parseShares(value: string): number | null {
  const normalized = value.trim();
  if (!/^[1-9]\d*$/.test(normalized)) return null;
  const shares = BigInt(normalized);
  if (shares > BigInt(1_000_000)) return null;
  return Number(shares);
}

function selectedSplits(splits: ExpenseDraftSplit[]): ExpenseDraftSplit[] {
  return splits.filter((split) => split.isSelected);
}

export function calculateExactTotalMinor(splits: ExpenseDraftSplit[]): string | null {
  let total = BigInt(0);
  for (const split of selectedSplits(splits)) {
    const amountMinor = parseAmountToMinorUnit(split.value, 2);
    if (amountMinor === null) return null;
    total += BigInt(amountMinor);
  }
  return total.toString();
}

export function calculatePercentageTotalBps(splits: ExpenseDraftSplit[]): number | null {
  let total = 0;
  for (const split of selectedSplits(splits)) {
    const percentageBps = parsePercentageToBasisPoints(split.value);
    if (percentageBps === null) return null;
    total += percentageBps;
  }
  return total;
}

export function buildExpenseInput(
  draft: ExpenseDraft,
  currency: string,
  groupMemberIds: readonly string[],
): CreateExpenseInput {
  const totalMinor = parseAmountToMinorUnit(draft.amount, 2);
  if (totalMinor === null || totalMinor === "0") {
    throw new Error("Enter a valid expense amount with no more than two decimal places");
  }

  const memberIds = new Set(groupMemberIds);
  if (!memberIds.has(draft.payerId)) {
    throw new Error("The payer must be a current group member");
  }

  const participants = selectedSplits(draft.splits);
  if (participants.length === 0) {
    throw new Error("Select at least one participant");
  }
  if (new Set(participants.map((participant) => participant.userId)).size !== participants.length) {
    throw new Error("Each participant can only be selected once");
  }
  if (participants.some((participant) => !memberIds.has(participant.userId))) {
    throw new Error("Every participant must be a current group member");
  }

  let split: ExpenseSplitInput;
  switch (draft.splitType) {
    case "EQUAL":
      split = {
        type: "EQUAL",
        participants: participants.map((participant) => ({ userId: participant.userId })),
      };
      break;
    case "EXACT": {
      const exactParticipants = participants.map((participant) => {
        const amountMinor = parseAmountToMinorUnit(participant.value, 2);
        if (amountMinor === null) {
          throw new Error("Enter valid exact amounts with no more than two decimal places");
        }
        return { userId: participant.userId, amountMinor };
      });
      const exactTotal = exactParticipants.reduce(
        (sum, participant) => sum + BigInt(participant.amountMinor),
        BigInt(0),
      );
      if (exactTotal !== BigInt(totalMinor)) {
        throw new Error("Exact amounts must add up to the expense total");
      }
      split = { type: "EXACT", participants: exactParticipants };
      break;
    }
    case "PERCENTAGE": {
      const percentageParticipants = participants.map((participant) => {
        const percentageBps = parsePercentageToBasisPoints(participant.value);
        if (percentageBps === null) {
          throw new Error("Enter percentages between 0 and 100 with no more than two decimal places");
        }
        return { userId: participant.userId, percentageBps };
      });
      const percentageTotal = percentageParticipants.reduce(
        (sum, participant) => sum + participant.percentageBps,
        0,
      );
      if (percentageTotal !== 10_000) {
        throw new Error("Percentages must add up to exactly 100%");
      }
      split = { type: "PERCENTAGE", participants: percentageParticipants };
      break;
    }
    case "SHARES": {
      const shareParticipants = participants.map((participant) => {
        const shares = parseShares(participant.value);
        if (shares === null) {
          throw new Error("Shares must be positive whole numbers");
        }
        return { userId: participant.userId, shares };
      });
      split = { type: "SHARES", participants: shareParticipants };
      break;
    }
  }

  return {
    title: draft.title.trim(),
    totalMinor,
    currency,
    payers: [{ userId: draft.payerId, amountMinor: totalMinor }],
    split,
  };
}

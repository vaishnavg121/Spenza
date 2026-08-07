export type Allocation = {
  userId: string;
  allocationMinor: bigint;
  order: number;
};

export type SplitInput =
  | { type: "EQUAL"; participants: Array<{ userId: string }> }
  | { type: "EXACT"; participants: Array<{ userId: string; amountMinor: bigint }> }
  | { type: "PERCENTAGE"; participants: Array<{ userId: string; percentageBps: bigint }> }
  | { type: "SHARES"; participants: Array<{ userId: string; shares: bigint }> };

export class SplitValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
  }
}

export function validatePayers(
  totalMinor: bigint,
  payers: Array<{ userId: string; contributionMinor: bigint }>,
) {
  if (payers.length === 0) {
    throw new SplitValidationError("EMPTY_PAYERS", "At least one payer is required");
  }
  const ids = new Set<string>();
  let contributions = 0n;
  for (const payer of payers) {
    if (!payer.userId || ids.has(payer.userId)) {
      throw new SplitValidationError("DUPLICATE_PAYER", "Payers must be distinct");
    }
    if (payer.contributionMinor <= 0n) {
      throw new SplitValidationError("INVALID_CONTRIBUTION", "Payer contributions must be positive");
    }
    ids.add(payer.userId);
    contributions += payer.contributionMinor;
  }
  if (contributions !== totalMinor) {
    throw new SplitValidationError("PAYER_TOTAL_MISMATCH", "Payer contributions must equal the expense total");
  }
}

function validateParticipants(participants: Array<{ userId: string }>) {
  if (participants.length === 0) {
    throw new SplitValidationError("EMPTY_PARTICIPANTS", "At least one participant is required");
  }
  const ids = new Set<string>();
  for (const participant of participants) {
    if (!participant.userId || ids.has(participant.userId)) {
      throw new SplitValidationError("DUPLICATE_PARTICIPANT", "Participants must be distinct");
    }
    ids.add(participant.userId);
  }
}

function largestRemainder(
  totalMinor: bigint,
  weighted: Array<{ userId: string; numerator: bigint }>,
  denominator: bigint,
): Allocation[] {
  const rows = weighted.map((participant, order) => ({
    userId: participant.userId,
    allocationMinor: participant.numerator / denominator,
    remainder: participant.numerator % denominator,
    order,
  }));
  let remaining = totalMinor - rows.reduce((sum, row) => sum + row.allocationMinor, 0n);
  const ranked = [...rows].sort((left, right) =>
    left.remainder === right.remainder
      ? left.order - right.order
      : left.remainder > right.remainder ? -1 : 1
  );
  for (const row of ranked) {
    if (remaining === 0n) break;
    rows[row.order].allocationMinor += 1n;
    remaining -= 1n;
  }
  return rows.map(({ userId, allocationMinor, order }) => ({ userId, allocationMinor, order }));
}

export function calculateSplit(totalMinor: bigint, input: SplitInput): Allocation[] {
  if (totalMinor <= 0n) {
    throw new SplitValidationError("INVALID_TOTAL", "Expense total must be positive");
  }
  validateParticipants(input.participants);

  if (input.type === "EXACT") {
    if (input.participants.some((participant) => participant.amountMinor < 0n)) {
      throw new SplitValidationError("NEGATIVE_ALLOCATION", "Allocations cannot be negative");
    }
    const sum = input.participants.reduce((value, participant) => value + participant.amountMinor, 0n);
    if (sum !== totalMinor) {
      throw new SplitValidationError("EXACT_TOTAL_MISMATCH", "Exact allocations must equal the expense total");
    }
    return input.participants.map((participant, order) => ({
      userId: participant.userId,
      allocationMinor: participant.amountMinor,
      order,
    }));
  }

  if (input.type === "EQUAL") {
    const denominator = BigInt(input.participants.length);
    return largestRemainder(
      totalMinor,
      input.participants.map(({ userId }) => ({ userId, numerator: totalMinor })),
      denominator,
    );
  }

  if (input.type === "PERCENTAGE") {
    if (input.participants.some((participant) => participant.percentageBps < 0n)) {
      throw new SplitValidationError("INVALID_PERCENTAGE", "Percentages cannot be negative");
    }
    const denominator = 10_000n;
    const totalBps = input.participants.reduce((value, participant) => value + participant.percentageBps, 0n);
    if (totalBps !== denominator) {
      throw new SplitValidationError("PERCENTAGE_TOTAL_MISMATCH", "Percentages must total exactly 10000 basis points");
    }
    return largestRemainder(
      totalMinor,
      input.participants.map(({ userId, percentageBps }) => ({
        userId,
        numerator: totalMinor * percentageBps,
      })),
      denominator,
    );
  }

  if (input.participants.some((participant) => participant.shares <= 0n)) {
    throw new SplitValidationError("INVALID_SHARES", "Share weights must be positive");
  }
  const denominator = input.participants.reduce((value, participant) => value + participant.shares, 0n);
  return largestRemainder(
    totalMinor,
    input.participants.map(({ userId, shares }) => ({
      userId,
      numerator: totalMinor * shares,
    })),
    denominator,
  );
}

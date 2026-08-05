"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as z from "zod";

const createSettlementSchema = z.object({
  groupId: z.string().optional(),
  payeeId: z.string(),
  amount: z.number().positive(),
  method: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OTHER"]).default("CASH"),
});

export async function createSettlement(data: z.infer<typeof createSettlementSchema>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = createSettlementSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { groupId, payeeId, amount, method } = parsed.data;

  // Validate payee exists and is not self
  if (payeeId === session.user.id) {
    throw new Error("Cannot settle with yourself");
  }

  const settlement = await prisma.$transaction(async (tx) => {
    const newSettlement = await tx.settlement.create({
      data: {
        payerId: session.user.id,
        payeeId,
        amount,
        method,
        groupId,
        status: "COMPLETED",
      },
    });

    await tx.activity.create({
      data: {
        userId: session.user.id,
        groupId,
        settlementId: newSettlement.id,
        action: "SETTLEMENT_MADE",
        details: { amount, method, payeeId },
      },
    });

    return newSettlement;
  });

  if (groupId) {
    revalidatePath(`/dashboard/groups/${groupId}`);
  }
  revalidatePath("/dashboard");
  
  return settlement;
}

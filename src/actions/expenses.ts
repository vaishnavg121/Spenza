"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import * as z from "zod";

export const createExpenseSchema = z.object({
  groupId: z.string(),
  title: z.string().min(1, "Title is required"),
  amount: z.number().positive("Amount must be greater than 0"),
  payerId: z.string().min(1, "Payer is required"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES", "CUSTOM"]),
  splits: z.array(
    z.object({
      userId: z.string(),
      value: z.number().nonnegative(),
      isSelected: z.boolean().default(true), // Used for EQUAL split to toggle participation
    })
  ),
});

export async function createExpense(data: z.infer<typeof createExpenseSchema>) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    throw new Error("Unauthorized");
  }

  const parsed = createExpenseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Invalid input");
  }

  const { groupId, title, amount, payerId, splitType, splits } = parsed.data;

  // Verify group membership
  const groupMember = await prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: session.user.id,
      },
    },
  });

  if (!groupMember) {
    throw new Error("You are not a member of this group");
  }

  // Calculate actual amounts owed based on split type
  let calculatedSplits = splits.map((s) => ({ ...s, amountOwed: 0 }));

  if (splitType === "EQUAL") {
    const participatingUsers = splits.filter((s) => s.isSelected);
    if (participatingUsers.length === 0) throw new Error("Select at least one participant");
    
    // JS floating point math handling - round to 2 decimals
    const equalAmount = Math.round((amount / participatingUsers.length) * 100) / 100;
    
    let totalAssigned = 0;
    calculatedSplits = calculatedSplits.map((s) => {
      if (s.isSelected) {
        totalAssigned += equalAmount;
        return { ...s, amountOwed: equalAmount };
      }
      return { ...s, amountOwed: 0 };
    });

    // Handle rounding error (give the remainder to the payer or first person)
    const difference = Math.round((amount - totalAssigned) * 100) / 100;
    if (difference !== 0) {
      const firstSelected = calculatedSplits.find(s => s.isSelected);
      if (firstSelected) {
          firstSelected.amountOwed = Math.round((firstSelected.amountOwed + difference) * 100) / 100;
      }
    }
  } else if (splitType === "EXACT") {
    const totalExact = splits.reduce((acc, curr) => acc + curr.value, 0);
    if (Math.abs(totalExact - amount) > 0.01) {
      throw new Error(`Split amounts must add up to the total amount. Off by ${Math.abs(totalExact - amount)}`);
    }
    calculatedSplits = calculatedSplits.map((s) => ({ ...s, amountOwed: s.value }));
  } else if (splitType === "PERCENTAGE") {
    const totalPercentage = splits.reduce((acc, curr) => acc + curr.value, 0);
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error("Percentages must add up to exactly 100%");
    }
    
    let totalAssigned = 0;
    calculatedSplits = calculatedSplits.map((s) => {
      const splitAmount = Math.round((amount * (s.value / 100)) * 100) / 100;
      totalAssigned += splitAmount;
      return { ...s, amountOwed: splitAmount };
    });

    const difference = Math.round((amount - totalAssigned) * 100) / 100;
    if (difference !== 0) {
       calculatedSplits[0].amountOwed = Math.round((calculatedSplits[0].amountOwed + difference) * 100) / 100;
    }
  } else if (splitType === "SHARES") {
    const totalShares = splits.reduce((acc, curr) => acc + curr.value, 0);
    if (totalShares === 0) throw new Error("Total shares must be greater than 0");

    let totalAssigned = 0;
    calculatedSplits = calculatedSplits.map((s) => {
      const splitAmount = Math.round((amount * (s.value / totalShares)) * 100) / 100;
      totalAssigned += splitAmount;
      return { ...s, amountOwed: splitAmount };
    });

    const difference = Math.round((amount - totalAssigned) * 100) / 100;
    if (difference !== 0) {
      const firstWithShares = calculatedSplits.find(s => s.value > 0);
      if (firstWithShares) {
          firstWithShares.amountOwed = Math.round((firstWithShares.amountOwed + difference) * 100) / 100;
      }
    }
  }

  // Create the Expense and Splits within a transaction
  const expense = await prisma.$transaction(async (tx) => {
    const newExpense = await tx.expense.create({
      data: {
        title,
        amount,
        creatorId: session.user.id,
        groupId,
        splitType,
        splits: {
          create: calculatedSplits.map((s) => ({
            userId: s.userId,
            amountPaid: s.userId === payerId ? amount : 0,
            amountOwed: s.amountOwed,
            percentage: splitType === "PERCENTAGE" ? s.value : null,
            shares: splitType === "SHARES" ? s.value : null,
          })),
        },
      },
    });

    // Add activity log
    await tx.activity.create({
      data: {
        userId: session.user.id,
        groupId,
        expenseId: newExpense.id,
        action: "EXPENSE_ADDED",
        details: { title, amount },
      },
    });

    return newExpense;
  });

  revalidatePath(`/dashboard/groups/${groupId}`);
  return expense;
}

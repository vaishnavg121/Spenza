"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";

export async function getDashboardData() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");
  const userId = session.user.id;

  // 1. Get all expense splits where user is involved
  const userSplits = await prisma.expenseSplit.findMany({
    where: { userId },
    include: {
      expense: {
        select: {
          amount: true,
          date: true,
        }
      }
    }
  });

  // 2. Get all settlements involving user
  const userSettlements = await prisma.settlement.findMany({
    where: {
      OR: [
        { payerId: userId },
        { payeeId: userId }
      ],
      status: "COMPLETED"
    }
  });

  // Calculate Balances
  let totalPaid = 0;
  let totalOwed = 0;

  userSplits.forEach(split => {
    totalPaid += split.amountPaid;
    totalOwed += split.amountOwed;
  });

  let settlementsSent = 0;
  let settlementsReceived = 0;

  userSettlements.forEach(settlement => {
    if (settlement.payerId === userId) {
      settlementsSent += settlement.amount;
    } else {
      settlementsReceived += settlement.amount;
    }
  });

  // Net balance logic: (Amount I physically paid for expenses - Amount I was supposed to pay for expenses) 
  // + Amount I've paid in settlements - Amount I've received in settlements
  const totalBalance = (totalPaid - totalOwed) + settlementsSent - settlementsReceived;
  
  // Calculate raw you owe / you are owed bounds
  let youOwe = 0;
  let youAreOwed = 0;

  if (totalBalance > 0) {
     youAreOwed = totalBalance;
  } else if (totalBalance < 0) {
     youOwe = Math.abs(totalBalance);
  }

  // 3. Activity Feed (Last 10)
  const activities = await prisma.activity.findMany({
    where: {
      OR: [
        { userId: userId },
        { group: { members: { some: { userId: userId } } } }
      ]
    },
    include: {
      user: { select: { name: true, image: true } },
      group: { select: { name: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  // 4. Chart Data (Spending over last 6 months)
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const date = subMonths(new Date(), i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    // Sum of what the user OWED (their share of expenses) in this month
    const monthlySpending = userSplits
      .filter(s => s.expense.date >= start && s.expense.date <= end)
      .reduce((sum, s) => sum + s.amountOwed, 0);

    chartData.push({
      month: format(date, 'MMM'),
      spending: Math.round(monthlySpending * 100) / 100,
    });
  }

  return {
    balances: {
      totalBalance: Math.round(totalBalance * 100) / 100,
      youOwe: Math.round(youOwe * 100) / 100,
      youAreOwed: Math.round(youAreOwed * 100) / 100,
    },
    activities,
    chartData
  };
}
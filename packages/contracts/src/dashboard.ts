import { z } from "zod";
import { CurrencyCodeSchema, ExpenseResponseSchema } from "./expense.js";
import { SignedMinorUnitStringSchema, SettlementResponseSchema } from "./settlement.js";
import { ActivityItemSchema } from "./activity.js";

const NonNegativeMinorUnitStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);

export const DashboardBalancesSchema = z.object({
  totalOwedMinor: NonNegativeMinorUnitStringSchema,
  totalOwingMinor: NonNegativeMinorUnitStringSchema,
  netBalanceMinor: SignedMinorUnitStringSchema,
  currency: CurrencyCodeSchema,
}).strict();

export const SpendingBarDataSchema = z.object({
  month: z.string(),
  spendingMinor: NonNegativeMinorUnitStringSchema,
}).strict();

export const DashboardCurrencySummarySchema = DashboardBalancesSchema.extend({
  spendingChart: z.array(SpendingBarDataSchema),
}).strict();

export const DashboardResponseSchema = z.object({
  currencySummaries: z.array(DashboardCurrencySummarySchema),
  recentExpenses: z.array(ExpenseResponseSchema),
  recentSettlements: z.array(SettlementResponseSchema),
  recentActivities: z.array(ActivityItemSchema),
}).strict();

export type DashboardBalances = z.infer<typeof DashboardBalancesSchema>;
export type SpendingBarData = z.infer<typeof SpendingBarDataSchema>;
export type DashboardCurrencySummary = z.infer<typeof DashboardCurrencySummarySchema>;
export type DashboardResponse = z.infer<typeof DashboardResponseSchema>;

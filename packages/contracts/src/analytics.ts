import { z } from "zod";
import { CurrencyCodeSchema } from "./expense.js";
import { SignedMinorUnitStringSchema } from "./settlement.js";

const NonNegativeMinorUnitStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);

export const AnalyticsQuerySchema = z
  .object({
    groupId: z.string().min(1).max(200).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  })
  .strict()
  .refine(
    (input) => {
      if (input.dateFrom && input.dateTo) {
        return new Date(input.dateFrom) <= new Date(input.dateTo);
      }
      return true;
    },
    { message: "dateFrom must be before or equal to dateTo", path: ["dateFrom"] }
  );

export const CategorySpendingSchema = z.object({
  categoryId: z.string().nullable(),
  categoryName: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  totalMinor: NonNegativeMinorUnitStringSchema,
  percentageBps: z.number().int().min(0).max(10_000),
}).strict();

export const MonthlyTrendSchema = z.object({
  month: z.string(),
  personalSpendingMinor: NonNegativeMinorUnitStringSchema,
  groupTotalMinor: NonNegativeMinorUnitStringSchema,
}).strict();

export const GroupSpendingSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  personalSpendingMinor: NonNegativeMinorUnitStringSchema,
  totalExpensesMinor: NonNegativeMinorUnitStringSchema,
}).strict();

export const AnalyticsResponseSchema = z.object({
  personalSpendingMinor: NonNegativeMinorUnitStringSchema,
  totalContributedMinor: NonNegativeMinorUnitStringSchema,
  totalGroupExpensesMinor: NonNegativeMinorUnitStringSchema,
  currency: CurrencyCodeSchema,
  categoryBreakdown: z.array(CategorySpendingSchema),
  monthlyTrends: z.array(MonthlyTrendSchema),
  groupBreakdown: z.array(GroupSpendingSchema),
}).strict();

export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type CategorySpending = z.infer<typeof CategorySpendingSchema>;
export type MonthlyTrend = z.infer<typeof MonthlyTrendSchema>;
export type GroupSpending = z.infer<typeof GroupSpendingSchema>;
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;

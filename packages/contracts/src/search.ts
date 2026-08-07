import { z } from "zod";
import { CurrencyCodeSchema, ExpenseResponseSchema, NonNegativeMinorUnitStringSchema } from "./expense.js";

export const ExpenseSearchQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200).optional(),
    groupId: z.string().min(1).max(200).optional(),
    categoryId: z.string().min(1).max(200).optional(),
    memberId: z.string().min(1).max(200).optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    minAmountMinor: NonNegativeMinorUnitStringSchema.optional(),
    maxAmountMinor: NonNegativeMinorUnitStringSchema.optional(),
    currency: CurrencyCodeSchema.optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z
      .string()
      .regex(/^([1-9]|[1-9]\d|100)$/)
      .transform(Number)
      .optional()
      .default(20),
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
  )
  .refine(
    (input) => {
      if (input.minAmountMinor && input.maxAmountMinor) {
        return BigInt(input.minAmountMinor) <= BigInt(input.maxAmountMinor);
      }
      return true;
    },
    { message: "minAmountMinor must be less than or equal to maxAmountMinor", path: ["minAmountMinor"] }
  );

export const ExpenseSearchPageSchema = z.object({
  data: z.array(ExpenseResponseSchema),
  page: z
    .object({
      nextCursor: z.string().nullable(),
      hasMore: z.boolean(),
    })
    .strict(),
}).strict();

export type ExpenseSearchQuery = z.infer<typeof ExpenseSearchQuerySchema>;
export type ExpenseSearchPage = z.infer<typeof ExpenseSearchPageSchema>;

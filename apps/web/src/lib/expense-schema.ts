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
      isSelected: z.boolean().default(true),
    })
  ),
});

export const createExpenseApiFormSchema = z.object({
  groupId: z.string(),
  title: z.string().trim().min(1, "Title is required"),
  amount: z.string().trim().min(1, "Amount is required"),
  payerId: z.string().min(1, "Payer is required"),
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]),
  splits: z.array(
    z.object({
      userId: z.string(),
      value: z.string(),
      isSelected: z.boolean(),
    }),
  ),
});

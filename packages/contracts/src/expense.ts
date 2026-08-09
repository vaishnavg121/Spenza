import { z } from "zod";

const POSTGRES_BIGINT_MAX = "9223372036854775807";
const isWithinPostgresBigInt = (value: string) =>
  value.length < POSTGRES_BIGINT_MAX.length ||
  (value.length === POSTGRES_BIGINT_MAX.length && value <= POSTGRES_BIGINT_MAX);

export const PositiveMinorUnitStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Expected a positive base-10 integer string")
  .refine(isWithinPostgresBigInt, "Amount exceeds the supported range");

export const NonNegativeMinorUnitStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)$/, "Expected a non-negative base-10 integer string")
  .refine(isWithinPostgresBigInt, "Amount exceeds the supported range");

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, "Expected an uppercase ISO 4217 code");

export const IdempotencyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/, "Idempotency key contains unsupported characters");

const ParticipantIdSchema = z.string().min(1);
const EqualSplitSchema = z.object({
  type: z.literal("EQUAL"),
  participants: z.array(z.object({ userId: ParticipantIdSchema }).strict()).min(1),
}).strict();
const ExactSplitSchema = z.object({
  type: z.literal("EXACT"),
  participants: z.array(z.object({
    userId: ParticipantIdSchema,
    amountMinor: NonNegativeMinorUnitStringSchema,
  }).strict()).min(1),
}).strict();
const PercentageSplitSchema = z.object({
  type: z.literal("PERCENTAGE"),
  participants: z.array(z.object({
    userId: ParticipantIdSchema,
    percentageBps: z.number().int().min(0).max(10_000),
  }).strict()).min(1),
}).strict();
const SharesSplitSchema = z.object({
  type: z.literal("SHARES"),
  participants: z.array(z.object({
    userId: ParticipantIdSchema,
    shares: z.number().int().positive().max(1_000_000),
  }).strict()).min(1),
}).strict();

export const ExpenseSplitInputSchema = z.discriminatedUnion("type", [
  EqualSplitSchema,
  ExactSplitSchema,
  PercentageSplitSchema,
  SharesSplitSchema,
]);

export const ExpensePayerInputSchema = z.object({
  userId: ParticipantIdSchema,
  amountMinor: PositiveMinorUnitStringSchema,
}).strict();

export const CreateExpenseSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1_000).nullable().optional(),
  totalMinor: PositiveMinorUnitStringSchema,
  currency: CurrencyCodeSchema,
  date: z.iso.datetime().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  payers: z.array(ExpensePayerInputSchema).min(1),
  split: ExpenseSplitInputSchema,
}).strict();

export const UpdateExpenseSchema = z.object({
  expectedVersion: z.number().int().positive(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1_000).nullable().optional(),
  totalMinor: PositiveMinorUnitStringSchema.optional(),
  date: z.iso.datetime().optional(),
  categoryId: z.string().min(1).nullable().optional(),
  payers: z.array(ExpensePayerInputSchema).min(1).optional(),
  split: ExpenseSplitInputSchema.optional(),
}).strict().refine(
  (input) => Object.keys(input).some((key) => key !== "expectedVersion"),
  { message: "At least one editable expense field is required" },
);

export const VoidExpenseSchema = z.object({
  expectedVersion: z.number().int().positive(),
}).strict();

export const ExpenseAllocationResponseSchema = z.object({
  userId: z.string(),
  allocationMinor: NonNegativeMinorUnitStringSchema,
  order: z.number().int().nonnegative(),
}).strict();

export const ExpensePaymentResponseSchema = z.object({
  userId: z.string(),
  contributionMinor: PositiveMinorUnitStringSchema,
  order: z.number().int().nonnegative(),
}).strict();

export const ExpenseResponseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  creatorId: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  categoryId: z.string().nullable(),
  categoryName: z.string().nullable().optional(),
  totalMinor: PositiveMinorUnitStringSchema,
  currency: CurrencyCodeSchema,
  splitType: z.enum(["EQUAL", "EXACT", "PERCENTAGE", "SHARES"]),
  version: z.number().int().positive(),
  date: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  voidedAt: z.iso.datetime().nullable().optional(),
  payers: z.array(ExpensePaymentResponseSchema),
  allocations: z.array(ExpenseAllocationResponseSchema),
}).strict();

export const ExpenseListQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z
    .string()
    .regex(/^([1-9]|[1-9]\d|100)$/)
    .transform((value) => Number(value))
    .optional()
    .default(20),
}).strict();

export const ExpensePageSchema = z.object({
  data: z.array(ExpenseResponseSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }).strict(),
}).strict();

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseSchema>;
export type VoidExpenseInput = z.infer<typeof VoidExpenseSchema>;
export type ExpenseSplitInput = z.infer<typeof ExpenseSplitInputSchema>;
export type ExpenseResponse = z.infer<typeof ExpenseResponseSchema>;
export type ExpenseListQuery = z.infer<typeof ExpenseListQuerySchema>;
export type ExpensePage = z.infer<typeof ExpensePageSchema>;

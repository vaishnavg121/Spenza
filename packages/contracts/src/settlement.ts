import { z } from "zod";
import { CurrencyCodeSchema, IdempotencyKeySchema, PositiveMinorUnitStringSchema } from "./expense.js";

const POSTGRES_BIGINT_MAX = "9223372036854775807";
const POSTGRES_BIGINT_MIN_ABS = "9223372036854775808";

function withinBound(value: string, bound: string): boolean {
  return value.length < bound.length || (value.length === bound.length && value <= bound);
}

export const SignedMinorUnitStringSchema = z.string().refine((value) => {
  if (value === "0") return true;
  if (/^[1-9]\d*$/.test(value)) return withinBound(value, POSTGRES_BIGINT_MAX);
  if (/^-[1-9]\d*$/.test(value)) return withinBound(value.slice(1), POSTGRES_BIGINT_MIN_ABS);
  return false;
}, "Expected a canonical signed base-10 integer string");

export const PaymentMethodSchema = z.enum(["CASH", "UPI", "BANK_TRANSFER", "OTHER"]);

export const CreateSettlementSchema = z.object({
  receiverId: z.string().min(1).max(200),
  amountMinor: PositiveMinorUnitStringSchema,
  currency: CurrencyCodeSchema,
  method: PaymentMethodSchema.optional().default("CASH"),
  date: z.iso.datetime().optional(),
}).strict();

export const ReverseSettlementSchema = z.object({}).strict();

export const SettlementResponseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  payerId: z.string(),
  receiverId: z.string(),
  amountMinor: PositiveMinorUnitStringSchema,
  currency: CurrencyCodeSchema,
  method: PaymentMethodSchema,
  kind: z.enum(["PAYMENT", "REVERSAL"]),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  reversesId: z.string().nullable(),
  createdById: z.string().nullable(),
  date: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();

export const SettlementListQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.string().regex(/^([1-9]|[1-9]\d|100)$/).transform(Number).optional().default(20),
}).strict();

export const SettlementPageSchema = z.object({
  data: z.array(SettlementResponseSchema),
  page: z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() }).strict(),
}).strict();

export const MemberBalanceSchema = z.object({
  userId: z.string(),
  netMinor: SignedMinorUnitStringSchema,
}).strict();

export const SuggestedTransferSchema = z.object({
  senderId: z.string(),
  receiverId: z.string(),
  amountMinor: PositiveMinorUnitStringSchema,
}).strict();

export const BalanceResponseSchema = z.object({
  groupId: z.string(),
  currency: CurrencyCodeSchema,
  currentUserId: z.string(),
  currentUserNetMinor: SignedMinorUnitStringSchema,
  youOweMinor: z.string().regex(/^(0|[1-9]\d*)$/),
  youAreOwedMinor: z.string().regex(/^(0|[1-9]\d*)$/),
  members: z.array(MemberBalanceSchema),
  suggestions: z.array(SuggestedTransferSchema),
}).strict();

export { IdempotencyKeySchema as SettlementIdempotencyKeySchema };

export type CreateSettlementInput = z.infer<typeof CreateSettlementSchema>;
export type SettlementResponse = z.infer<typeof SettlementResponseSchema>;
export type SettlementListQuery = z.infer<typeof SettlementListQuerySchema>;
export type SettlementPage = z.infer<typeof SettlementPageSchema>;
export type BalanceResponse = z.infer<typeof BalanceResponseSchema>;
export type MemberBalance = z.infer<typeof MemberBalanceSchema>;
export type SuggestedTransfer = z.infer<typeof SuggestedTransferSchema>;

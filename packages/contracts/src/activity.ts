import { z } from "zod";

export const ActivityActionSchema = z.enum([
  "GROUP_CREATED",
  "USER_JOINED",
  "EXPENSE_ADDED",
  "EXPENSE_UPDATED",
  "EXPENSE_DELETED",
  "SETTLEMENT_MADE",
  "SETTLEMENT_REVERSED",
]);

export const ActivityUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullable(),
}).strict();

export const ActivityGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
}).strict();

export const ActivityItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  groupId: z.string().nullable(),
  expenseId: z.string().nullable(),
  settlementId: z.string().nullable(),
  action: ActivityActionSchema,
  details: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.string().datetime(),
  user: ActivityUserSchema.optional(),
  group: ActivityGroupSchema.nullable().optional(),
}).strict();

export const ActivityListQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z
    .string()
    .regex(/^([1-9]|[1-9]\d|100)$/)
    .transform(Number)
    .optional()
    .default(20),
}).strict();

export const ActivityPageSchema = z.object({
  data: z.array(ActivityItemSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }).strict(),
}).strict();

export type ActivityAction = z.infer<typeof ActivityActionSchema>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;
export type ActivityListQuery = z.infer<typeof ActivityListQuerySchema>;
export type ActivityPage = z.infer<typeof ActivityPageSchema>;

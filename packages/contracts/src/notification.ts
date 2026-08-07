import { z } from "zod";

export const NotificationTypeSchema = z.enum([
  "EXPENSE_ADDED",
  "SETTLEMENT_COMPLETED",
  "GROUP_INVITE",
  "REMINDER",
  "MENTION",
  "SYSTEM",
]);

export const NotificationResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  body: z.string(),
  type: NotificationTypeSchema,
  isRead: z.boolean(),
  link: z.string().nullable(),
  createdAt: z.iso.datetime(),
}).strict();

export const NotificationPageSchema = z.object({
  data: z.array(NotificationResponseSchema),
  page: z.object({
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  }).strict(),
  unreadCount: z.number().int().nonnegative(),
}).strict();

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
}).strict();

export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;
export type NotificationPage = z.infer<typeof NotificationPageSchema>;
export type PushSubscriptionInput = z.infer<typeof PushSubscriptionSchema>;

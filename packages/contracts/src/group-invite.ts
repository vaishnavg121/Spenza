import { z } from "zod";

export const GroupInviteTokenSchema = z.string().min(64).max(2048);

export const GroupInvitePreviewSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  currency: z.string(),
  inviterId: z.string(),
  inviterName: z.string(),
  expiresAt: z.iso.datetime(),
}).strict();

export const GroupInviteCreatedSchema = z.object({
  token: GroupInviteTokenSchema,
  expiresAt: z.iso.datetime(),
}).strict();

export const GroupInviteAcceptanceSchema = z.object({
  groupId: z.string(),
  alreadyMember: z.boolean(),
  friendshipChanged: z.boolean(),
}).strict();

export type GroupInvitePreview = z.infer<typeof GroupInvitePreviewSchema>;
export type GroupInviteCreated = z.infer<typeof GroupInviteCreatedSchema>;
export type GroupInviteAcceptance = z.infer<typeof GroupInviteAcceptanceSchema>;

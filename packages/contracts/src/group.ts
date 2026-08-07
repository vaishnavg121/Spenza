import { z } from "zod";

export const CreateGroupSchema = z.object({
  name: z.string().trim().min(2, "Group name must be at least 2 characters").max(100),
  description: z.string().trim().max(500).optional(),
  currency: z.string().length(3, "Currency code must be 3 letters").default("USD"),
  imageUrl: z.string().url("Invalid image URL").optional(),
});
export type CreateGroupInput = z.infer<typeof CreateGroupSchema>;

export const UpdateGroupSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  currency: z.string().length(3).optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateGroupInput = z.infer<typeof UpdateGroupSchema>;

export const GroupMemberUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  image: z.string().nullable().optional(),
});
export type GroupMemberUser = z.infer<typeof GroupMemberUserSchema>;

export const GroupMemberResponseSchema = z.object({
  id: z.string(),
  groupId: z.string(),
  userId: z.string(),
  role: z.enum(["ADMIN", "MEMBER"]),
  isFavorite: z.boolean(),
  createdAt: z.string(),
  user: GroupMemberUserSchema,
});
export type GroupMemberResponse = z.infer<typeof GroupMemberResponseSchema>;

export const GroupResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  currency: z.string(),
  inviteLink: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  members: z.array(GroupMemberResponseSchema),
  _count: z
    .object({
      expenses: z.number().optional(),
    })
    .optional(),
});
export type GroupResponse = z.infer<typeof GroupResponseSchema>;

export const AddGroupMemberSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  role: z.enum(["ADMIN", "MEMBER"]).optional().default("MEMBER"),
});
export type AddGroupMemberInput = z.infer<typeof AddGroupMemberSchema>;

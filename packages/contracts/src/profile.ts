import { z } from "zod";

export const ProfileSchema = z.object({ id: z.string(), name: z.string(), username: z.string().nullable(), email: z.email(), phone: z.string().nullable(), currency: z.string().length(3), theme: z.enum(["light", "dark", "system"]).nullable(), avatar: z.string().nullable() });
export const UpdateProfileSchema = z.object({ name: z.string().trim().min(2).max(100).optional(), username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(), phone: z.string().trim().min(3).max(32).nullable().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), theme: z.enum(["light", "dark", "system"]).optional(), avatar: z.string().trim().max(255).nullable().optional() }).strict();
export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfile = z.infer<typeof UpdateProfileSchema>;

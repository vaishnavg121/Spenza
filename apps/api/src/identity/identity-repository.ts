import type { PrismaClient, User } from "@prisma/client";

export type EditableProfile = Pick<User, "name" | "username" | "phone" | "currency" | "theme" | "image">;
export interface IdentityRepository {
  findByClerkSubjectId(subject: string): Promise<User | null>;
  findLegacyCandidatesByEmail(email: string): Promise<User[]>;
  createUser(input: Pick<User, "id" | "name" | "email" | "clerkSubjectId">): Promise<User>;
  updateProfile(userId: string, input: Partial<EditableProfile>): Promise<User>;
}

export function createPrismaIdentityRepository(prisma: PrismaClient): IdentityRepository {
  return {
    findByClerkSubjectId: (clerkSubjectId) => prisma.user.findUnique({ where: { clerkSubjectId } }),
    findLegacyCandidatesByEmail: (email) => prisma.user.findMany({ where: { email, clerkSubjectId: null } }),
    createUser: (data) => prisma.user.create({ data }),
    updateProfile: (id, data) => prisma.user.update({ where: { id }, data }),
  };
}

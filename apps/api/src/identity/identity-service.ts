import type { User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { IdentityRepository } from "./identity-repository.js";

export type TrustedClerkIdentity = { clerkSubjectId: string; primaryVerifiedEmail: string; displayName?: string | null };
export type IdentityResolution = { kind: "resolved"; user: User } | { kind: "legacy-reconciliation-required" };
export class IdentityConflictError extends Error { readonly code = "IDENTITY_CONFLICT"; }
export class IdentityRepositoryError extends Error { readonly code = "IDENTITY_RESOLUTION_FAILED"; }
const isUniqueViolation = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export class IdentityService {
  constructor(private readonly repository: IdentityRepository) {}
  async resolve(identity: TrustedClerkIdentity): Promise<IdentityResolution> {
    let existing: User | null;
    try { existing = await this.repository.findByClerkSubjectId(identity.clerkSubjectId); } catch { throw new IdentityRepositoryError(); }
    if (existing) return { kind: "resolved", user: existing };
    let candidates: User[];
    try { candidates = await this.repository.findLegacyCandidatesByEmail(identity.primaryVerifiedEmail); } catch { throw new IdentityRepositoryError(); }
    if (candidates.length > 0) return { kind: "legacy-reconciliation-required" };
    try {
      return { kind: "resolved", user: await this.repository.createUser({ id: randomUUID(), clerkSubjectId: identity.clerkSubjectId, email: identity.primaryVerifiedEmail, name: identity.displayName?.trim() || "Spenza user" }) };
    } catch (error) {
      if (!isUniqueViolation(error)) throw new IdentityRepositoryError();
      const raced = await this.repository.findByClerkSubjectId(identity.clerkSubjectId);
      if (raced) return { kind: "resolved", user: raced };
      throw new IdentityConflictError();
    }
  }
}

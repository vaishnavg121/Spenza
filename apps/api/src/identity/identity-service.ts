import type { User } from "@prisma/client";
import { randomUUID } from "node:crypto";
import type { IdentityRepository } from "./identity-repository.js";
import { AppError, ConflictError } from "../errors/app-error.js";

export type TrustedClerkIdentity = { clerkSubjectId: string; primaryVerifiedEmail: string; displayName?: string | null };
export type IdentityResolution = { kind: "resolved"; user: User } | { kind: "legacy-reconciliation-required" };
export class IdentityConflictError extends ConflictError {
  constructor(message = "Identity conflict", code = "IDENTITY_CONFLICT") {
    super(message, code);
  }
}
export class IdentityRepositoryError extends AppError {
  constructor(message = "Identity resolution failed", code = "IDENTITY_RESOLUTION_FAILED") {
    super(500, code, message);
  }
}
const isUniqueViolation = (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "P2002";

export class IdentityService {
  constructor(private readonly repository: IdentityRepository) {}
  async resolve(identity: TrustedClerkIdentity): Promise<IdentityResolution> {
    let existing: User | null;
    try { existing = await this.repository.findByClerkSubjectId(identity.clerkSubjectId); } catch (err) { throw new IdentityRepositoryError(err instanceof Error ? err.message : "Database error finding user by Clerk subject ID"); }
    if (existing) return { kind: "resolved", user: existing };
    let candidates: User[];
    try { candidates = await this.repository.findLegacyCandidatesByEmail(identity.primaryVerifiedEmail); } catch (err) { throw new IdentityRepositoryError(err instanceof Error ? err.message : "Database error finding legacy candidates"); }
    if (candidates.length > 0) return { kind: "legacy-reconciliation-required" };
    try {
      return { kind: "resolved", user: await this.repository.createUser({ id: randomUUID(), clerkSubjectId: identity.clerkSubjectId, email: identity.primaryVerifiedEmail, name: identity.displayName?.trim() || "Spenza user" }) };
    } catch (error) {
      if (!isUniqueViolation(error)) throw new IdentityRepositoryError(error instanceof Error ? error.message : "Database error creating user");
      const raced = await this.repository.findByClerkSubjectId(identity.clerkSubjectId);
      if (raced) return { kind: "resolved", user: raced };
      throw new IdentityConflictError();
    }
  }
}

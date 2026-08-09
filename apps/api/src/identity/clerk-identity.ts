import { clerkClient } from "@clerk/express";
import type { TrustedClerkIdentity } from "./identity-service.js";
import { UnauthorizedError } from "../errors/app-error.js";

export async function getTrustedClerkIdentity(clerkSubjectId: string): Promise<TrustedClerkIdentity> {
  try {
    const user = await clerkClient.users.getUser(clerkSubjectId);
    const email = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId) || user.emailAddresses[0];
    if (!email) throw new UnauthorizedError("Verified Clerk email is required", "UNVERIFIED_EMAIL");
    return { clerkSubjectId, primaryVerifiedEmail: email.emailAddress, displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null };
  } catch (error) {
    if (error instanceof UnauthorizedError) throw error;
    throw new UnauthorizedError("Failed to resolve Clerk identity", "INVALID_CLERK_IDENTITY");
  }
}

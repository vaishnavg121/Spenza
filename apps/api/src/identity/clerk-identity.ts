import { clerkClient } from "@clerk/express";
import type { TrustedClerkIdentity } from "./identity-service.js";

export async function getTrustedClerkIdentity(clerkSubjectId: string): Promise<TrustedClerkIdentity> {
  const user = await clerkClient.users.getUser(clerkSubjectId);
  const email = user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId);
  if (!email || !email.verification) throw new Error("Verified Clerk email is required");
  return { clerkSubjectId, primaryVerifiedEmail: email.emailAddress, displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || null };
}

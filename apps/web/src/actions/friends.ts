"use server";

import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FriendEmailSchema = z.string().trim().email();

export type FriendRequestFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "IDENTITY_LINK_REQUIRED"
  | "INVALID_EMAIL"
  | "CANNOT_ADD_SELF"
  | "USER_NOT_FOUND"
  | "ALREADY_FRIENDS"
  | "REQUEST_ALREADY_EXISTS";

export type SendFriendRequestResult =
  | { ok: true; friendshipId: string }
  | { ok: false; code: FriendRequestFailureCode; message: string };

export type FriendRequestMutationFailureCode =
  | "AUTHENTICATION_REQUIRED"
  | "IDENTITY_LINK_REQUIRED"
  | "INVALID_REQUEST"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_ALREADY_HANDLED";

export type FriendRequestMutationResult =
  | { ok: true }
  | { ok: false; code: FriendRequestMutationFailureCode; message: string };

function friendRequestFailure(
  code: FriendRequestFailureCode,
  message: string,
): SendFriendRequestResult {
  return { ok: false, code, message };
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function resolveCurrentInternalUser(): Promise<{
  clerkSubjectId: string | null;
  user: { id: string } | null;
}> {
  const { userId } = await auth();
  if (!userId) {
    return { clerkSubjectId: null, user: null };
  }

  const user = await prisma.user.findUnique({
    where: { clerkSubjectId: userId },
    select: { id: true },
  });
  return { clerkSubjectId: userId, user };
}

async function resolveMutationActor(): Promise<
  { ok: true; user: { id: string } } | Extract<FriendRequestMutationResult, { ok: false }>
> {
  const actor = await resolveCurrentInternalUser();
  if (!actor.clerkSubjectId) {
    return { ok: false, code: "AUTHENTICATION_REQUIRED", message: "Please sign in again" };
  }
  if (!actor.user) {
    return {
      ok: false,
      code: "IDENTITY_LINK_REQUIRED",
      message: "Your Clerk account is not linked to a Spenza profile",
    };
  }
  return { ok: true, user: actor.user };
}

async function requireCurrentInternalUser(): Promise<{ id: string }> {
  const actor = await resolveMutationActor();
  if (!actor.ok) throw new Error(actor.message);
  return actor.user;
}

export async function sendFriendRequest(email: string): Promise<SendFriendRequestResult> {
  const actor = await resolveCurrentInternalUser();

  if (!actor.clerkSubjectId) {
    return friendRequestFailure("AUTHENTICATION_REQUIRED", "Please sign in again to add a friend");
  }
  if (!actor.user) {
    return friendRequestFailure(
      "IDENTITY_LINK_REQUIRED",
      "Your Clerk account is not linked to a Spenza profile",
    );
  }

  const parsedEmail = FriendEmailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return friendRequestFailure("INVALID_EMAIL", "Enter a valid email address");
  }

  const normalizedEmail = parsedEmail.data.toLowerCase();
  const targetUser = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
  });

  if (!targetUser) {
    return friendRequestFailure("USER_NOT_FOUND", "No Spenza account was found for this email");
  }

  if (targetUser.id === actor.user.id) {
    return friendRequestFailure("CANNOT_ADD_SELF", "You cannot send a friend request to yourself");
  }

  // Check existing friendship
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { user1Id: actor.user.id, user2Id: targetUser.id },
        { user1Id: targetUser.id, user2Id: actor.user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return friendRequestFailure("ALREADY_FRIENDS", "You are already friends");
    }
    return friendRequestFailure("REQUEST_ALREADY_EXISTS", "A friend request already exists");
  }

  let friendship: { id: string };
  try {
    friendship = await prisma.friendship.create({
      data: {
        user1Id: actor.user.id,
        user2Id: targetUser.id,
        status: "PENDING",
      },
      select: { id: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return friendRequestFailure("REQUEST_ALREADY_EXISTS", "A friend request already exists");
    }
    throw error;
  }

  revalidatePath("/dashboard/friends");
  return { ok: true, friendshipId: friendship.id };
}

export async function acceptFriendRequest(friendshipId: string): Promise<FriendRequestMutationResult> {
  const actor = await resolveMutationActor();
  if (!actor.ok) return actor;
  if (!z.string().min(1).safeParse(friendshipId).success) {
    return { ok: false, code: "INVALID_REQUEST", message: "Invalid friend request" };
  }

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.user2Id !== actor.user.id) {
    return { ok: false, code: "REQUEST_NOT_FOUND", message: "Friend request not found" };
  }
  if (friendship.status !== "PENDING") {
    return { ok: false, code: "REQUEST_ALREADY_HANDLED", message: "This friend request was already handled" };
  }
  const updated = await prisma.friendship.updateMany({
    where: { id: friendshipId, user2Id: actor.user.id, status: "PENDING" },
    data: { status: "ACCEPTED" },
  });
  if (updated.count !== 1) {
    return { ok: false, code: "REQUEST_ALREADY_HANDLED", message: "This friend request was already handled" };
  }

  revalidatePath("/dashboard/friends");
  return { ok: true };
}

export async function declineFriendRequest(friendshipId: string): Promise<FriendRequestMutationResult> {
  const actor = await resolveMutationActor();
  if (!actor.ok) return actor;
  if (!z.string().min(1).safeParse(friendshipId).success) {
    return { ok: false, code: "INVALID_REQUEST", message: "Invalid friend request" };
  }

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.user2Id !== actor.user.id) {
    return { ok: false, code: "REQUEST_NOT_FOUND", message: "Friend request not found" };
  }
  if (friendship.status !== "PENDING") {
    return { ok: false, code: "REQUEST_ALREADY_HANDLED", message: "This friend request was already handled" };
  }
  const updated = await prisma.friendship.updateMany({
    where: { id: friendshipId, user2Id: actor.user.id, status: "PENDING" },
    data: { status: "DECLINED" },
  });
  if (updated.count !== 1) {
    return { ok: false, code: "REQUEST_ALREADY_HANDLED", message: "This friend request was already handled" };
  }

  revalidatePath("/dashboard/friends");
  return { ok: true };
}

export async function getFriends() {
  const actor = await requireCurrentInternalUser();

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { user1Id: actor.id },
        { user2Id: actor.id },
      ],
      status: "ACCEPTED",
    },
    include: {
      user1: { select: { id: true, name: true, email: true, image: true } },
      user2: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  // Map to just the "other" user
  return friendships.map((f) => {
    return f.user1Id === actor.id ? f.user2 : f.user1;
  });
}

export async function getPendingRequests() {
  const actor = await requireCurrentInternalUser();

  const requests = await prisma.friendship.findMany({
    where: {
      user2Id: actor.id,
      status: "PENDING",
    },
    include: {
      user1: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return requests;
}

export async function getOutgoingRequests() {
  const actor = await requireCurrentInternalUser();
  return prisma.friendship.findMany({
    where: { user1Id: actor.id, status: "PENDING" },
    include: {
      user2: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

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

async function requireCurrentInternalUser(): Promise<{ id: string }> {
  const actor = await resolveCurrentInternalUser();
  if (!actor.clerkSubjectId) throw new Error("Unauthorized");
  if (!actor.user) throw new Error("Clerk identity is not linked to a Spenza user");
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

  // Log activity
  await prisma.activity.create({
    data: {
      userId: actor.user.id,
      action: "GROUP_CREATED", // Temporarily using this action enum or we can add FRIEND_REQUEST_SENT later
      details: { target: targetUser.email, type: "FRIEND_REQUEST" },
    },
  });

  revalidatePath("/dashboard/friends");
  return { ok: true, friendshipId: friendship.id };
}

export async function acceptFriendRequest(friendshipId: string) {
  const actor = await requireCurrentInternalUser();

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.user2Id !== actor.id) {
    throw new Error("Friend request not found or unauthorized");
  }

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: "ACCEPTED" },
  });

  revalidatePath("/dashboard/friends");
  return true;
}

export async function declineFriendRequest(friendshipId: string) {
  const actor = await requireCurrentInternalUser();

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.user2Id !== actor.id) {
    throw new Error("Friend request not found or unauthorized");
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath("/dashboard/friends");
  return true;
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

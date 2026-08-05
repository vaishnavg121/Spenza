"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(email: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");
  if (session.user.email === email) throw new Error("You cannot send a friend request to yourself");

  const targetUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!targetUser) {
    throw new Error("User with this email not found");
  }

  // Check existing friendship
  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { user1Id: session.user.id, user2Id: targetUser.id },
        { user1Id: targetUser.id, user2Id: session.user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") throw new Error("You are already friends");
    if (existing.status === "PENDING") throw new Error("A friend request is already pending");
  }

  const friendship = await prisma.friendship.create({
    data: {
      user1Id: session.user.id,
      user2Id: targetUser.id,
      status: "PENDING",
    },
  });

  // Log activity
  await prisma.activity.create({
    data: {
      userId: session.user.id,
      action: "GROUP_CREATED", // Temporarily using this action enum or we can add FRIEND_REQUEST_SENT later
      details: { target: targetUser.email, type: "FRIEND_REQUEST" },
    },
  });

  revalidatePath("/dashboard/friends");
  return friendship;
}

export async function acceptFriendRequest(friendshipId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.user2Id !== session.user.id) {
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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");

  const friendship = await prisma.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship || friendship.user2Id !== session.user.id) {
    throw new Error("Friend request not found or unauthorized");
  }

  await prisma.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath("/dashboard/friends");
  return true;
}

export async function getFriends() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { user1Id: session.user.id },
        { user2Id: session.user.id },
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
    return f.user1Id === session.user.id ? f.user2 : f.user1;
  });
}

export async function getPendingRequests() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) throw new Error("Unauthorized");

  const requests = await prisma.friendship.findMany({
    where: {
      user2Id: session.user.id,
      status: "PENDING",
    },
    include: {
      user1: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return requests;
}
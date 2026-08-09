import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clerkAuth: vi.fn(),
  findCurrentUser: vi.fn(),
  findUser: vi.fn(),
  findFriendship: vi.fn(),
  createFriendship: vi.fn(),
  findFriendshipById: vi.fn(),
  updateFriendships: vi.fn(),
  listFriendships: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.clerkAuth,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.findCurrentUser,
      findFirst: mocks.findUser,
    },
    friendship: {
      findFirst: mocks.findFriendship,
      findUnique: mocks.findFriendshipById,
      findMany: mocks.listFriendships,
      create: mocks.createFriendship,
      updateMany: mocks.updateFriendships,
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { acceptFriendRequest, declineFriendRequest, getOutgoingRequests, sendFriendRequest } from "./friends";

const currentUser = {
  id: "user_current",
  email: "current@example.com",
  name: "Current User",
};

const targetUser = {
  id: "user_target",
  email: "target@example.com",
  name: "Target User",
};

describe("sendFriendRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkAuth.mockResolvedValue({ userId: "clerk_current" });
    mocks.findCurrentUser.mockResolvedValue({ id: currentUser.id });
    mocks.findUser.mockResolvedValue(targetUser);
    mocks.findFriendship.mockResolvedValue(null);
    mocks.createFriendship.mockResolvedValue({ id: "friendship_1" });
    mocks.updateFriendships.mockResolvedValue({ count: 1 });
  });

  it("returns a structured user-not-found result", async () => {
    mocks.findUser.mockResolvedValue(null);

    await expect(sendFriendRequest("missing@example.com")).resolves.toEqual({
      ok: false,
      code: "USER_NOT_FOUND",
      message: "No Spenza account was found for this email",
    });
    expect(mocks.createFriendship).not.toHaveBeenCalled();
  });

  it("returns a structured result when adding yourself", async () => {
    mocks.findUser.mockResolvedValue(currentUser);

    await expect(sendFriendRequest(" CURRENT@example.com ")).resolves.toMatchObject({
      ok: false,
      code: "CANNOT_ADD_SELF",
    });
    expect(mocks.createFriendship).not.toHaveBeenCalled();
  });

  it("resolves the actor only by the verified Clerk subject", async () => {
    await sendFriendRequest(targetUser.email);

    expect(mocks.findCurrentUser).toHaveBeenCalledWith({
      where: { clerkSubjectId: "clerk_current" },
      select: { id: true },
    });
  });

  it("fails closed when the Clerk subject has no internal mapping", async () => {
    mocks.findCurrentUser.mockResolvedValue(null);

    await expect(sendFriendRequest(targetUser.email)).resolves.toMatchObject({
      ok: false,
      code: "IDENTITY_LINK_REQUIRED",
    });
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.createFriendship).not.toHaveBeenCalled();
  });

  it("returns a structured result for an accepted friendship", async () => {
    mocks.findFriendship.mockResolvedValue({ status: "ACCEPTED" });

    await expect(sendFriendRequest(targetUser.email)).resolves.toMatchObject({
      ok: false,
      code: "ALREADY_FRIENDS",
    });
    expect(mocks.createFriendship).not.toHaveBeenCalled();
  });

  it("returns a structured result when a request already exists", async () => {
    mocks.findFriendship.mockResolvedValue({ status: "PENDING" });

    await expect(sendFriendRequest(targetUser.email)).resolves.toMatchObject({
      ok: false,
      code: "REQUEST_ALREADY_EXISTS",
    });
    expect(mocks.createFriendship).not.toHaveBeenCalled();
  });

  it("returns a structured result if concurrent creation hits the unique constraint", async () => {
    mocks.createFriendship.mockRejectedValue({ code: "P2002" });

    await expect(sendFriendRequest(targetUser.email)).resolves.toMatchObject({
      ok: false,
      code: "REQUEST_ALREADY_EXISTS",
    });
  });

  it("creates a pending friend request for a valid target", async () => {
    await expect(sendFriendRequest(targetUser.email)).resolves.toEqual({
      ok: true,
      friendshipId: "friendship_1",
    });
    expect(mocks.createFriendship).toHaveBeenCalledWith({
      data: {
        user1Id: currentUser.id,
        user2Id: targetUser.id,
        status: "PENDING",
      },
      select: { id: true },
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/friends");
  });

  it("does not hide unexpected persistence errors", async () => {
    const persistenceError = new Error("database unavailable");
    mocks.createFriendship.mockRejectedValue(persistenceError);

    await expect(sendFriendRequest(targetUser.email)).rejects.toBe(persistenceError);
  });
});

describe("incoming friend request lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clerkAuth.mockResolvedValue({ userId: "clerk_current" });
    mocks.findCurrentUser.mockResolvedValue({ id: currentUser.id });
    mocks.updateFriendships.mockResolvedValue({ count: 1 });
  });

  it("accepts a pending request only as its recipient", async () => {
    mocks.findFriendshipById.mockResolvedValue({ id: "request_1", user1Id: targetUser.id, user2Id: currentUser.id, status: "PENDING" });
    await expect(acceptFriendRequest("request_1")).resolves.toEqual({ ok: true });
    expect(mocks.updateFriendships).toHaveBeenCalledWith({
      where: { id: "request_1", user2Id: currentUser.id, status: "PENDING" },
      data: { status: "ACCEPTED" },
    });
  });

  it("rejects an incoming request without deleting its audit state", async () => {
    mocks.findFriendshipById.mockResolvedValue({ id: "request_1", user1Id: targetUser.id, user2Id: currentUser.id, status: "PENDING" });
    await expect(declineFriendRequest("request_1")).resolves.toEqual({ ok: true });
    expect(mocks.updateFriendships).toHaveBeenCalledWith({
      where: { id: "request_1", user2Id: currentUser.id, status: "PENDING" },
      data: { status: "DECLINED" },
    });
  });

  it("does not allow the sender to accept their outgoing request", async () => {
    mocks.findFriendshipById.mockResolvedValue({ id: "request_1", user1Id: currentUser.id, user2Id: targetUser.id, status: "PENDING" });
    await expect(acceptFriendRequest("request_1")).resolves.toMatchObject({ ok: false, code: "REQUEST_NOT_FOUND" });
    expect(mocks.updateFriendships).not.toHaveBeenCalled();
  });

  it("returns a structured result when a request was handled concurrently", async () => {
    mocks.findFriendshipById.mockResolvedValue({ id: "request_1", user1Id: targetUser.id, user2Id: currentUser.id, status: "PENDING" });
    mocks.updateFriendships.mockResolvedValue({ count: 0 });
    await expect(acceptFriendRequest("request_1")).resolves.toMatchObject({ ok: false, code: "REQUEST_ALREADY_HANDLED" });
  });

  it("lists outgoing requests using the verified internal actor", async () => {
    mocks.listFriendships.mockResolvedValue([]);
    await expect(getOutgoingRequests()).resolves.toEqual([]);
    expect(mocks.listFriendships).toHaveBeenCalledWith(expect.objectContaining({
      where: { user1Id: currentUser.id, status: "PENDING" },
    }));
  });
});

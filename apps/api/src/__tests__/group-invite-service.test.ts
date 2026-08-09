import { beforeEach, describe, expect, it } from "vitest";
import type {
  AcceptInviteResult,
  GroupInviteRepository,
  InviteContext,
  InviteCreationGroup,
} from "../group-invites/group-invite-repository.js";
import { GroupInviteService } from "../group-invites/group-invite-service.js";
import { GroupInviteTokenCodec } from "../group-invites/group-invite-token.js";

const baseNow = Date.parse("2026-08-09T00:00:00.000Z");
const secret = "test-group-invite-secret-with-at-least-thirty-two-bytes";

class InMemoryInviteRepository implements GroupInviteRepository {
  actorRole: "ADMIN" | "MEMBER" | null = "ADMIN";
  inviteHash: string | null = null;
  members = new Map<string, "ADMIN" | "MEMBER">([["inviter_1", "ADMIN"]]);
  friendshipStatus: "PENDING" | "ACCEPTED" | "DECLINED" | null = null;
  lastMembershipRole: "ADMIN" | "MEMBER" | null = null;

  async findForCreation(groupId: string, _actorUserId: string): Promise<InviteCreationGroup | null> {
    if (groupId !== "group_1") return null;
    return { id: groupId, name: "Trip", currency: "INR", actorRole: this.actorRole };
  }

  async storeInviteHash(_groupId: string, inviteHash: string): Promise<void> {
    this.inviteHash = inviteHash;
  }

  async revokeInviteHash(_groupId: string, _actorUserId: string) {
    if (this.actorRole === null) return "NOT_FOUND" as const;
    if (this.actorRole !== "ADMIN") return "FORBIDDEN" as const;
    this.inviteHash = null;
    return "REVOKED" as const;
  }

  async findInviteContext(groupId: string, inviterId: string, inviteHash: string): Promise<InviteContext | null> {
    if (groupId !== "group_1" || inviterId !== "inviter_1" || inviteHash !== this.inviteHash) return null;
    return { groupId, groupName: "Trip", currency: "INR", inviterId, inviterName: "Inviter" };
  }

  async acceptInvite(
    groupId: string,
    inviterId: string,
    joinerId: string,
    inviteHash: string,
  ): Promise<AcceptInviteResult | null> {
    if (groupId !== "group_1" || inviterId !== "inviter_1" || inviteHash !== this.inviteHash) return null;
    const alreadyMember = this.members.has(joinerId);
    if (!alreadyMember) {
      this.members.set(joinerId, "MEMBER");
      this.lastMembershipRole = "MEMBER";
    }
    let friendshipChanged = false;
    if (joinerId !== inviterId && this.friendshipStatus !== "ACCEPTED") {
      this.friendshipStatus = "ACCEPTED";
      friendshipChanged = true;
    }
    return { alreadyMember, friendshipChanged };
  }
}

describe("GroupInviteService", () => {
  let repository: InMemoryInviteRepository;
  let now: number;
  let service: GroupInviteService;

  beforeEach(() => {
    repository = new InMemoryInviteRepository();
    now = baseNow;
    service = new GroupInviteService(repository, new GroupInviteTokenCodec(secret), () => now);
  });

  it("allows an admin to create an unpredictable token and stores only its hash", async () => {
    const first = await service.createInvite("inviter_1", "group_1");
    const second = await service.createInvite("inviter_1", "group_1");
    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThan(64);
    expect(repository.inviteHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.inviteHash).not.toContain(second.token);
  });

  it("rejects non-admin invite creation", async () => {
    repository.actorRole = "MEMBER";
    await expect(service.createInvite("member_1", "group_1")).rejects.toMatchObject({ statusCode: 403 });
  });

  it("previews and accepts a valid invite with MEMBER role and accepted friendship", async () => {
    const invite = await service.createInvite("inviter_1", "group_1");
    await expect(service.previewInvite(invite.token)).resolves.toMatchObject({ groupName: "Trip", inviterName: "Inviter" });
    await expect(service.acceptInvite("joiner_1", invite.token)).resolves.toEqual({
      groupId: "group_1", alreadyMember: false, friendshipChanged: true,
    });
    expect(repository.lastMembershipRole).toBe("MEMBER");
    expect(repository.friendshipStatus).toBe("ACCEPTED");
  });

  it("accepts an existing pending friendship without creating a duplicate", async () => {
    repository.friendshipStatus = "PENDING";
    const invite = await service.createInvite("inviter_1", "group_1");
    await service.acceptInvite("joiner_1", invite.token);
    expect(repository.friendshipStatus).toBe("ACCEPTED");
    await expect(service.acceptInvite("joiner_1", invite.token)).resolves.toMatchObject({
      alreadyMember: true, friendshipChanged: false,
    });
  });

  it("handles inviter self-acceptance and existing membership idempotently", async () => {
    const invite = await service.createInvite("inviter_1", "group_1");
    await expect(service.acceptInvite("inviter_1", invite.token)).resolves.toEqual({
      groupId: "group_1", alreadyMember: true, friendshipChanged: false,
    });
  });

  it("rejects expired, revoked, and modified tokens", async () => {
    const invite = await service.createInvite("inviter_1", "group_1");
    now += 8 * 24 * 60 * 60 * 1000;
    await expect(service.previewInvite(invite.token)).rejects.toMatchObject({ code: "GROUP_INVITE_EXPIRED", statusCode: 410 });

    now = baseNow;
    repository.inviteHash = null;
    await expect(service.previewInvite(invite.token)).rejects.toMatchObject({ code: "GROUP_INVITE_REVOKED", statusCode: 410 });

    const modified = `${invite.token.slice(0, -1)}${invite.token.endsWith("a") ? "b" : "a"}`;
    await expect(service.previewInvite(modified)).rejects.toMatchObject({ code: "GROUP_INVITE_INVALID", statusCode: 404 });
  });
});

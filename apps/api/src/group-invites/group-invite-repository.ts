import { PrismaClient } from "@prisma/client";

export type InviteCreationGroup = {
  id: string;
  name: string;
  currency: string;
  actorRole: "ADMIN" | "MEMBER" | null;
};

export type InviteContext = {
  groupId: string;
  groupName: string;
  currency: string;
  inviterId: string;
  inviterName: string;
};

export type AcceptInviteResult = {
  alreadyMember: boolean;
  friendshipChanged: boolean;
};

export interface GroupInviteRepository {
  findForCreation(groupId: string, actorUserId: string): Promise<InviteCreationGroup | null>;
  storeInviteHash(groupId: string, inviteHash: string): Promise<void>;
  revokeInviteHash(groupId: string, actorUserId: string): Promise<"REVOKED" | "NOT_FOUND" | "FORBIDDEN">;
  findInviteContext(groupId: string, inviterId: string, inviteHash: string): Promise<InviteContext | null>;
  acceptInvite(groupId: string, inviterId: string, joinerId: string, inviteHash: string): Promise<AcceptInviteResult | null>;
}

export class PrismaGroupInviteRepository implements GroupInviteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findForCreation(groupId: string, actorUserId: string): Promise<InviteCreationGroup | null> {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        currency: true,
        members: { where: { userId: actorUserId }, select: { role: true }, take: 1 },
      },
    });
    if (!group) return null;
    return { ...group, actorRole: group.members[0]?.role ?? null };
  }

  async storeInviteHash(groupId: string, inviteHash: string): Promise<void> {
    await this.prisma.group.update({ where: { id: groupId }, data: { inviteLink: inviteHash } });
  }

  async revokeInviteHash(groupId: string, actorUserId: string): Promise<"REVOKED" | "NOT_FOUND" | "FORBIDDEN"> {
    const group = await this.findForCreation(groupId, actorUserId);
    if (!group || group.actorRole === null) return "NOT_FOUND";
    if (group.actorRole !== "ADMIN") return "FORBIDDEN";
    await this.prisma.group.update({ where: { id: groupId }, data: { inviteLink: null } });
    return "REVOKED";
  }

  async findInviteContext(groupId: string, inviterId: string, inviteHash: string): Promise<InviteContext | null> {
    const group = await this.prisma.group.findFirst({
      where: { id: groupId, inviteLink: inviteHash, isArchived: false },
      select: {
        id: true,
        name: true,
        currency: true,
        members: {
          where: { userId: inviterId },
          select: { user: { select: { id: true, name: true } } },
          take: 1,
        },
      },
    });
    const inviter = group?.members[0]?.user;
    if (!group || !inviter) return null;
    return {
      groupId: group.id,
      groupName: group.name,
      currency: group.currency,
      inviterId: inviter.id,
      inviterName: inviter.name,
    };
  }

  async acceptInvite(
    groupId: string,
    inviterId: string,
    joinerId: string,
    inviteHash: string,
  ): Promise<AcceptInviteResult | null> {
    return this.prisma.$transaction(async (transaction) => {
      const context = await transaction.group.findFirst({
        where: {
          id: groupId,
          inviteLink: inviteHash,
          isArchived: false,
          members: { some: { userId: inviterId } },
        },
        select: { id: true },
      });
      if (!context) return null;

      const membership = await transaction.groupMember.createMany({
        data: [{ groupId, userId: joinerId, role: "MEMBER" }],
        skipDuplicates: true,
      });

      let friendshipChanged = false;
      if (inviterId !== joinerId) {
        const existing = await transaction.friendship.findFirst({
          where: {
            OR: [
              { user1Id: inviterId, user2Id: joinerId },
              { user1Id: joinerId, user2Id: inviterId },
            ],
          },
          select: { id: true, status: true },
        });
        if (existing) {
          if (existing.status !== "ACCEPTED") {
            await transaction.friendship.update({ where: { id: existing.id }, data: { status: "ACCEPTED" } });
            friendshipChanged = true;
          }
        } else {
          const [user1Id, user2Id] = inviterId < joinerId ? [inviterId, joinerId] : [joinerId, inviterId];
          await transaction.friendship.upsert({
            where: { user1Id_user2Id: { user1Id, user2Id } },
            update: { status: "ACCEPTED" },
            create: { user1Id, user2Id, status: "ACCEPTED" },
          });
          friendshipChanged = true;
        }
      }

      if (membership.count === 1) {
        await transaction.activity.create({
          data: {
            userId: joinerId,
            groupId,
            action: "USER_JOINED",
            details: { source: "GROUP_INVITE", inviterId },
          },
        });
      }

      return { alreadyMember: membership.count === 0, friendshipChanged };
    });
  }
}

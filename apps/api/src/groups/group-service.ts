import { CreateGroupInput, UpdateGroupInput, AddGroupMemberInput, GroupResponse } from "@spenza/contracts";
import { DuplicateGroupMemberError, GroupRepository, GroupWithMembers } from "./group-repository.js";
import { NotFoundError, ForbiddenError, ConflictError } from "../errors/app-error.js";

export class GroupService {
  constructor(private readonly repository: GroupRepository) {}

  async createGroup(actorUserId: string, data: CreateGroupInput): Promise<GroupResponse> {
    const group = await this.repository.createGroup(actorUserId, data);
    return this.serializeGroup(group);
  }

  async getUserGroups(actorUserId: string): Promise<GroupResponse[]> {
    const groups = await this.repository.findGroupsByUserId(actorUserId);
    return groups.map((g) => this.serializeGroup(g));
  }

  async getGroupById(actorUserId: string, groupId: string): Promise<GroupResponse> {
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError("Group not found");
    }

    // Object-level authorization: actor MUST be a member
    const isMember = group.members.some((m) => m.userId === actorUserId);
    if (!isMember) {
      throw new NotFoundError("Group not found");
    }

    return this.serializeGroup(group);
  }

  async updateGroup(actorUserId: string, groupId: string, data: UpdateGroupInput): Promise<GroupResponse> {
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError("Group not found");
    }

    // Object-level authorization: actor MUST be an ADMIN
    const member = group.members.find((m) => m.userId === actorUserId);
    if (!member) {
      throw new NotFoundError("Group not found");
    }
    if (member.role !== "ADMIN") {
      throw new ForbiddenError("Only group administrators can update group details");
    }

    const updated = await this.repository.updateGroup(groupId, data);
    return this.serializeGroup(updated);
  }

  async addGroupMember(actorUserId: string, groupId: string, input: AddGroupMemberInput): Promise<GroupResponse> {
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError("Group not found");
    }

    // Object-level authorization: actor MUST be an ADMIN
    const actorMember = group.members.find((m) => m.userId === actorUserId);
    if (!actorMember) {
      throw new NotFoundError("Group not found");
    }
    if (actorMember.role !== "ADMIN") {
      throw new ForbiddenError("Only group administrators can add new members");
    }

    // Reject self and existing members before resolving friendship eligibility.
    const existingMember = group.members.find((m) => m.userId === input.userId);
    if (existingMember) {
      throw new ConflictError("User is already a member of this group", "GROUP_MEMBER_ALREADY_EXISTS");
    }

    const targetUser = await this.repository.findAcceptedFriend(actorUserId, input.userId);
    if (!targetUser) {
      throw new ForbiddenError(
        "Only accepted friends can be added to a group",
        "ACCEPTED_FRIEND_REQUIRED",
      );
    }

    try {
      await this.repository.addMember(groupId, targetUser.id, "MEMBER");
    } catch (error) {
      if (error instanceof DuplicateGroupMemberError) {
        throw new ConflictError("User is already a member of this group", "GROUP_MEMBER_ALREADY_EXISTS");
      }
      throw error;
    }
    await this.repository.createActivity(targetUser.id, groupId, "USER_JOINED", { name: targetUser.name });

    const updated = await this.repository.findGroupById(groupId);
    if (!updated) {
      throw new NotFoundError("Group not found");
    }
    return this.serializeGroup(updated);
  }

  async removeGroupMember(actorUserId: string, groupId: string, targetUserId: string): Promise<void> {
    const group = await this.repository.findGroupById(groupId);
    if (!group) {
      throw new NotFoundError("Group not found");
    }

    const actorMember = group.members.find((m) => m.userId === actorUserId);
    if (!actorMember) {
      throw new NotFoundError("Group not found");
    }

    const targetMember = group.members.find((m) => m.userId === targetUserId);
    if (!targetMember) {
      throw new NotFoundError("Member not found in group");
    }

    // Removing someone else requires administrator authority.
    if (actorUserId !== targetUserId && actorMember.role !== "ADMIN") {
      throw new ForbiddenError("Only group administrators can remove other members");
    }

    const adminCount = targetMember.role === "ADMIN"
      ? await this.repository.countAdmins(groupId)
      : 0;
    if (targetMember.role === "ADMIN" && adminCount <= 1) {
      throw new ConflictError(
        actorUserId === targetUserId
          ? "The sole administrator cannot leave. Archive the group or appoint another administrator first."
          : "The sole administrator cannot be removed",
        "SOLE_ADMIN_REQUIRED",
      );
    }

    // Membership history is not yet modeled independently from active membership.
    // Fail closed whenever removal would hide or orphan a member's financial history.
    if (await this.repository.hasFinancialHistory(groupId, targetUserId)) {
      throw new ConflictError(
        "This member has expense or settlement history and cannot be removed safely",
        "MEMBER_HAS_FINANCIAL_HISTORY",
      );
    }

    await this.repository.removeMember(groupId, targetUserId);
  }

  private serializeGroup(group: GroupWithMembers): GroupResponse {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      imageUrl: group.imageUrl,
      currency: group.currency,
      // The database column temporarily stores only the active invite token hash.
      // Never expose that server-side verifier through the group response.
      inviteLink: null,
      isArchived: group.isArchived,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
      members: group.members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        userId: m.userId,
        role: m.role as "ADMIN" | "MEMBER",
        isFavorite: m.isFavorite,
        createdAt: m.createdAt.toISOString(),
        user: {
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          image: m.user.image,
        },
      })),
      _count: group._count,
    };
  }
}

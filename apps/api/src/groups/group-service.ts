import { CreateGroupInput, UpdateGroupInput, AddGroupMemberInput, GroupResponse } from "@spenza/contracts";
import { GroupRepository, GroupWithMembers } from "./group-repository.js";
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

    // Find target user by email
    const targetUser = await this.repository.findUserByEmail(input.email);
    if (!targetUser) {
      throw new NotFoundError(`No registered user found with email ${input.email}`);
    }

    // Check if user is already a member
    const existingMember = group.members.find((m) => m.userId === targetUser.id);
    if (existingMember) {
      throw new ConflictError("User is already a member of this group");
    }

    await this.repository.addMember(groupId, targetUser.id, input.role || "MEMBER");
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

    // If actor is removing themselves (leaving the group)
    if (actorUserId === targetUserId) {
      if (actorMember.role === "ADMIN" && group.members.length > 1) {
        const adminCount = await this.repository.countAdmins(groupId);
        if (adminCount <= 1) {
          throw new ConflictError("Cannot leave group as the sole administrator. Appoint another admin first.");
        }
      }
    } else {
      // If actor is removing someone else, actor MUST be an ADMIN
      if (actorMember.role !== "ADMIN") {
        throw new ForbiddenError("Only group administrators can remove other members");
      }
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
      inviteLink: group.inviteLink,
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

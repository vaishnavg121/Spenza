import { PrismaClient, Prisma, Group, GroupMember, GroupRole, Activity } from "@prisma/client";
import { CreateGroupInput, UpdateGroupInput } from "@spenza/contracts";

export interface GroupWithMembers extends Group {
  members: (GroupMember & {
    user: {
      id: string;
      name: string;
      email: string;
      image: string | null;
    };
  })[];
  _count?: {
    expenses: number;
  };
}

export interface GroupRepository {
  createGroup(userId: string, data: CreateGroupInput): Promise<GroupWithMembers>;
  findGroupById(groupId: string): Promise<GroupWithMembers | null>;
  findGroupsByUserId(userId: string): Promise<GroupWithMembers[]>;
  updateGroup(groupId: string, data: UpdateGroupInput): Promise<GroupWithMembers>;
  findMember(groupId: string, userId: string): Promise<GroupMember | null>;
  addMember(groupId: string, userId: string, role: GroupRole): Promise<GroupMember>;
  removeMember(groupId: string, userId: string): Promise<void>;
  countAdmins(groupId: string): Promise<number>;
  findUserByEmail(email: string): Promise<{ id: string; name: string; email: string; image: string | null } | null>;
  createActivity(userId: string, groupId: string, action: "GROUP_CREATED" | "USER_JOINED", details?: Record<string, unknown>): Promise<Activity>;
}

export class PrismaGroupRepository implements GroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createGroup(userId: string, data: CreateGroupInput): Promise<GroupWithMembers> {
    return this.prisma.group.create({
      data: {
        name: data.name,
        description: data.description || null,
        currency: data.currency,
        imageUrl: data.imageUrl || null,
        members: {
          create: {
            userId,
            role: "ADMIN",
          },
        },
        activities: {
          create: {
            userId,
            action: "GROUP_CREATED",
            details: { name: data.name },
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { expenses: true },
        },
      },
    });
  }

  async findGroupById(groupId: string): Promise<GroupWithMembers | null> {
    return this.prisma.group.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { expenses: true },
        },
      },
    });
  }

  async findGroupsByUserId(userId: string): Promise<GroupWithMembers[]> {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
        isArchived: false,
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { expenses: true },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
  }

  async updateGroup(groupId: string, data: UpdateGroupInput): Promise<GroupWithMembers> {
    return this.prisma.group.update({
      where: { id: groupId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.isArchived !== undefined && { isArchived: data.isArchived }),
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
        },
        _count: {
          select: { expenses: true },
        },
      },
    });
  }

  async findMember(groupId: string, userId: string): Promise<GroupMember | null> {
    return this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });
  }

  async addMember(groupId: string, userId: string, role: GroupRole): Promise<GroupMember> {
    return this.prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role,
      },
    });
  }

  async removeMember(groupId: string, userId: string): Promise<void> {
    await this.prisma.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
    });
  }

  async countAdmins(groupId: string): Promise<number> {
    return this.prisma.groupMember.count({
      where: {
        groupId,
        role: "ADMIN",
      },
    });
  }

  async findUserByEmail(email: string): Promise<{ id: string; name: string; email: string; image: string | null } | null> {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true },
    });
  }

  async createActivity(userId: string, groupId: string, action: "GROUP_CREATED" | "USER_JOINED", details?: Record<string, unknown>): Promise<Activity> {
    return this.prisma.activity.create({
      data: {
        userId,
        groupId,
        action,
        details: (details as Prisma.InputJsonValue) || {},
      },
    });
  }
}

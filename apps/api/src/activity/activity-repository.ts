import { PrismaClient, Prisma, ActivityAction } from "@prisma/client";

export type ActivityRecord = {
  id: string;
  userId: string;
  groupId: string | null;
  expenseId: string | null;
  settlementId: string | null;
  action: ActivityAction;
  details: Record<string, unknown> | null;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    image: string | null;
  };
  group?: {
    id: string;
    name: string;
  } | null;
};

export interface ActivityRepository {
  findUserGroupIds(userId: string): Promise<string[]>;
  listActivitiesForUser(
    userId: string,
    groupIds: string[],
    options: { cursorId?: string; take: number }
  ): Promise<ActivityRecord[]>;
}

type PrismaActivityWithRelations = Prisma.ActivityGetPayload<{
  include: {
    user: { select: { id: true; name: true; image: true } };
    group: { select: { id: true; name: true } };
  };
}>;

function mapActivity(record: PrismaActivityWithRelations): ActivityRecord {
  return {
    id: record.id,
    userId: record.userId,
    groupId: record.groupId,
    expenseId: record.expenseId,
    settlementId: record.settlementId,
    action: record.action,
    details: (record.details as Record<string, unknown> | null) ?? null,
    createdAt: record.createdAt,
    user: record.user
      ? {
          id: record.user.id,
          name: record.user.name,
          image: record.user.image,
        }
      : undefined,
    group: record.group
      ? {
          id: record.group.id,
          name: record.group.name,
        }
      : null,
  };
}

export class PrismaActivityRepository implements ActivityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUserGroupIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId },
      select: { groupId: true },
    });
    return memberships.map((m) => m.groupId);
  }

  async listActivitiesForUser(
    userId: string,
    groupIds: string[],
    options: { cursorId?: string; take: number }
  ): Promise<ActivityRecord[]> {
    let cursorRecord: { createdAt: Date; id: string } | null = null;
    if (options.cursorId) {
      cursorRecord = await this.prisma.activity.findUnique({
        where: { id: options.cursorId },
        select: { createdAt: true, id: true },
      });
    }

    const whereClause: Prisma.ActivityWhereInput = {
      OR: [
        ...(groupIds.length > 0 ? [{ groupId: { in: groupIds } }] : []),
        { userId, groupId: null },
      ],
    };

    if (cursorRecord) {
      whereClause.AND = [
        {
          OR: [
            { createdAt: { lt: cursorRecord.createdAt } },
            {
              createdAt: cursorRecord.createdAt,
              id: { lt: cursorRecord.id },
            },
          ],
        },
      ];
    }

    const records = await this.prisma.activity.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take: options.take,
    });

    return records.map(mapActivity);
  }
}

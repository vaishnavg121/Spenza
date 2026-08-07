import {
  ActivityItemSchema,
  ActivityPageSchema,
  type ActivityItem,
  type ActivityListQuery,
  type ActivityPage,
} from "@spenza/contracts";
import { ValidationError } from "../errors/app-error.js";
import { type ActivityRecord, type ActivityRepository } from "./activity-repository.js";

function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (!decoded || encodeCursor(decoded) !== cursor) {
    throw new ValidationError("Invalid activity cursor");
  }
  return decoded;
}

export function serializeActivity(record: ActivityRecord): ActivityItem {
  return ActivityItemSchema.parse({
    id: record.id,
    userId: record.userId,
    groupId: record.groupId,
    expenseId: record.expenseId,
    settlementId: record.settlementId,
    action: record.action,
    details: record.details,
    createdAt: record.createdAt.toISOString(),
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
  });
}

export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  async listActivities(actorUserId: string, query: ActivityListQuery): Promise<ActivityPage> {
    const groupIds = await this.repository.findUserGroupIds(actorUserId);
    const cursorId = decodeCursor(query.cursor);
    const take = query.limit + 1;

    const records = await this.repository.listActivitiesForUser(actorUserId, groupIds, { cursorId, take });
    const hasMore = records.length > query.limit;
    const items = hasMore ? records.slice(0, query.limit) : records;
    const nextCursor = hasMore && items.length > 0 ? encodeCursor(items[items.length - 1].id) : null;

    return ActivityPageSchema.parse({
      data: items.map(serializeActivity),
      page: {
        nextCursor,
        hasMore,
      },
    });
  }
}

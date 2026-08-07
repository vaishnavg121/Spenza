import {
  NotificationPageSchema,
  NotificationResponseSchema,
  PushSubscriptionInput,
  type NotificationPage,
  type NotificationResponse,
} from "@spenza/contracts";
import { ValidationError } from "../errors/app-error.js";
import { NotificationRepository, NotificationRecord } from "./notification-repository.js";

function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (!decoded || encodeCursor(decoded) !== cursor) {
    throw new ValidationError("Invalid cursor");
  }
  return decoded;
}

export function serializeNotification(record: NotificationRecord): NotificationResponse {
  return NotificationResponseSchema.parse({
    id: record.id,
    userId: record.userId,
    title: record.title,
    body: record.body,
    type: record.type,
    isRead: record.isRead,
    link: record.link,
    createdAt: record.createdAt.toISOString(),
  });
}

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  async subscribe(actorUserId: string, input: PushSubscriptionInput): Promise<void> {
    await this.repository.createSubscription({
      userId: actorUserId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
    });
  }

  async unsubscribe(actorUserId: string, subscriptionId: string): Promise<void> {
    await this.repository.deleteSubscription(subscriptionId, actorUserId);
  }

  async unsubscribeByEndpoint(actorUserId: string, endpoint: string): Promise<void> {
    await this.repository.deleteSubscriptionByEndpoint(endpoint, actorUserId);
  }

  async listNotifications(actorUserId: string, cursor?: string, limit: number = 20): Promise<NotificationPage> {
    const cursorId = decodeCursor(cursor);
    const take = limit + 1;

    const records = await this.repository.listNotifications(actorUserId, { cursorId, take });
    const hasMore = records.length > limit;
    const items = hasMore ? records.slice(0, limit) : records;
    const nextCursor = hasMore && items.length > 0 ? encodeCursor(items[items.length - 1].id) : null;
    const unreadCount = await this.repository.getUnreadCount(actorUserId);

    return NotificationPageSchema.parse({
      data: items.map(serializeNotification),
      page: { nextCursor, hasMore },
      unreadCount,
    });
  }

  async markAsRead(actorUserId: string, notificationId?: string): Promise<void> {
    await this.repository.markAsRead(actorUserId, notificationId);
  }
}

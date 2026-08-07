import { PrismaClient, NotificationType, PushSubscription as PrismaPushSubscription, Notification as PrismaNotification } from "@prisma/client";

export type PushSubscriptionRecord = PrismaPushSubscription;
export type NotificationRecord = PrismaNotification;

export interface NotificationRepository {
  createSubscription(data: Omit<PushSubscriptionRecord, "id" | "createdAt" | "updatedAt">): Promise<PushSubscriptionRecord>;
  deleteSubscription(subscriptionId: string, userId: string): Promise<void>;
  deleteSubscriptionByEndpoint(endpoint: string, userId: string): Promise<void>;
  findSubscriptionsByUser(userId: string): Promise<PushSubscriptionRecord[]>;
  
  listNotifications(userId: string, options: { cursorId?: string; take: number }): Promise<NotificationRecord[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(userId: string, notificationId?: string): Promise<void>;
}

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createSubscription(data: Omit<PushSubscriptionRecord, "id" | "createdAt" | "updatedAt">): Promise<PushSubscriptionRecord> {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: data.endpoint },
      update: { userId: data.userId, p256dh: data.p256dh, auth: data.auth },
      create: data,
    });
  }

  async deleteSubscription(subscriptionId: string, userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { id: subscriptionId, userId },
    });
  }

  async deleteSubscriptionByEndpoint(endpoint: string, userId: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({
      where: { endpoint, userId },
    });
  }

  async findSubscriptionsByUser(userId: string): Promise<PushSubscriptionRecord[]> {
    return this.prisma.pushSubscription.findMany({ where: { userId } });
  }

  async listNotifications(userId: string, options: { cursorId?: string; take: number }): Promise<NotificationRecord[]> {
    let cursorRecord: { createdAt: Date; id: string } | null = null;
    if (options.cursorId) {
      cursorRecord = await this.prisma.notification.findUnique({
        where: { id: options.cursorId },
        select: { createdAt: true, id: true },
      });
    }

    const where: any = { userId };
    if (cursorRecord) {
      where.OR = [
        { createdAt: { lt: cursorRecord.createdAt } },
        { createdAt: cursorRecord.createdAt, id: { lt: cursorRecord.id } },
      ];
    }

    return this.prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: options.take,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(userId: string, notificationId?: string): Promise<void> {
    if (notificationId) {
      await this.prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true },
      });
    } else {
      await this.prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }
  }
}

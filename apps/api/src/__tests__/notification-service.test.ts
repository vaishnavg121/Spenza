import { describe, expect, it } from "vitest";
import { NotificationService } from "../notifications/notification-service.js";
import { NotificationRepository, NotificationRecord, PushSubscriptionRecord } from "../notifications/notification-repository.js";

class InMemoryNotificationRepo implements NotificationRepository {
  public subs: PushSubscriptionRecord[] = [];
  public notes: NotificationRecord[] = [
    { id: "note_1", userId: "user_1", title: "Test", body: "Hello", type: "SYSTEM", isRead: false, link: null, createdAt: new Date() },
    { id: "note_2", userId: "user_1", title: "Test2", body: "World", type: "SYSTEM", isRead: true, link: null, createdAt: new Date() },
    { id: "note_3", userId: "user_2", title: "Test3", body: "Other", type: "SYSTEM", isRead: false, link: null, createdAt: new Date() },
  ];

  async createSubscription(data: any) {
    const sub = { id: "sub_1", createdAt: new Date(), updatedAt: new Date(), ...data };
    this.subs.push(sub);
    return sub;
  }
  async deleteSubscription(subId: string, userId: string) {
    this.subs = this.subs.filter(s => !(s.id === subId && s.userId === userId));
  }
  async deleteSubscriptionByEndpoint(endpoint: string, userId: string) {
    this.subs = this.subs.filter(s => !(s.endpoint === endpoint && s.userId === userId));
  }
  async findSubscriptionsByUser(userId: string) {
    return this.subs.filter(s => s.userId === userId);
  }
  async listNotifications(userId: string, options: any) {
    return this.notes.filter(n => n.userId === userId).slice(0, options.take);
  }
  async getUnreadCount(userId: string) {
    return this.notes.filter(n => n.userId === userId && !n.isRead).length;
  }
  async markAsRead(userId: string, notificationId?: string) {
    this.notes.forEach(n => {
      if (n.userId === userId && (!notificationId || n.id === notificationId)) {
        n.isRead = true;
      }
    });
  }
}

describe("NotificationService", () => {
  it("lists notifications for authorized user only", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);

    const res = await service.listNotifications("user_1", undefined, 20);
    expect(res.data).toHaveLength(2);
    expect(res.unreadCount).toBe(1);
    expect(res.data.map(d => d.userId)).toEqual(["user_1", "user_1"]);
  });

  it("marks notifications as read", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);

    await service.markAsRead("user_1");
    const res = await service.listNotifications("user_1", undefined, 20);
    expect(res.unreadCount).toBe(0);
  });

  it("subscribes and unsubscribes web push", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);

    await service.subscribe("user_1", {
      endpoint: "https://push.example.com",
      keys: { p256dh: "key", auth: "auth" }
    });

    expect(repo.subs).toHaveLength(1);

    await service.unsubscribe("user_1", "sub_1");
    expect(repo.subs).toHaveLength(0);
  });

  it("prevents unsubscription of others push", async () => {
    const repo = new InMemoryNotificationRepo();
    const service = new NotificationService(repo);

    await service.subscribe("user_1", {
      endpoint: "https://push.example.com",
      keys: { p256dh: "key", auth: "auth" }
    });

    await service.unsubscribe("user_2", "sub_1");
    expect(repo.subs).toHaveLength(1); // Not deleted
  });
});

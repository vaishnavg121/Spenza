import webpush from "web-push";
import { PrismaClient } from "@prisma/client";

// Set VAPID details (mocked or loaded from env)
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY || "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBtc3sOEHhK2yJ1v31Qk8lMvw";
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || "8_Q_wXF-kXlF1Z2a_G2f91RjJ_8D6Vq4G8L-QpBvK-E";
const vapidSubject = process.env.VAPID_SUBJECT || "mailto:test@spenza.local";

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

export interface PushService {
  sendPushNotification(userId: string, payload: { title: string; body: string; url?: string }): Promise<void>;
  processOutbox(): Promise<void>;
}

export class DefaultPushService implements PushService {
  constructor(private readonly prisma: PrismaClient) {}

  async sendPushNotification(userId: string, payload: { title: string; body: string; url?: string }): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error: any) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          await this.prisma.pushSubscription.delete({ where: { id: sub.id } });
        } else {
          console.error("Failed to send push notification:", error);
        }
      }
    }
  }

  async processOutbox(): Promise<void> {
    const pendingEvents = await this.prisma.outboxEvent.findMany({
      where: { status: "PENDING" },
      take: 10,
    });

    for (const event of pendingEvents) {
      try {
        const payload = event.payload as any; // e.g. { userId, title, body, type }
        
        // Ensure an in-app notification exists
        if (payload.userId && payload.title) {
           await this.prisma.notification.create({
             data: {
               userId: payload.userId,
               title: payload.title,
               body: payload.body,
               type: payload.type || "SYSTEM",
               link: payload.url,
             }
           });
           
           // Send Web Push
           await this.sendPushNotification(payload.userId, {
             title: payload.title,
             body: payload.body,
             url: payload.url,
           });
        }

        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSED" },
        });
      } catch (error: any) {
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "FAILED",
            error: error.message,
            attempts: { increment: 1 },
          },
        });
      }
    }
  }
}

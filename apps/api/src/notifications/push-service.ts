import webpush from "web-push";
import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

function setupVapid(): boolean {
  const isProduction = env.NODE_ENV === "production";
  const vapidPublicKey = env.VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const vapidPrivateKey = env.VAPID_PRIVATE_KEY || process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = env.VAPID_SUBJECT || process.env.VAPID_SUBJECT || "mailto:test@spenza.local";

  if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    return true;
  }

  if (isProduction) {
    throw new Error("VAPID keys (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY) are required in production.");
  }

  logger.info("Web Push: disabled in local development");
  return false;
}

const isWebPushEnabled = setupVapid();

export interface PushService {
  sendPushNotification(userId: string, payload: { title: string; body: string; url?: string }): Promise<void>;
  processOutbox(): Promise<void>;
}

export class DefaultPushService implements PushService {
  constructor(private readonly prisma: PrismaClient) {}

  async sendPushNotification(userId: string, payload: { title: string; body: string; url?: string }): Promise<void> {
    if (!isWebPushEnabled) {
      logger.debug({ userId }, "Skipping push notification: Web Push is disabled");
      return;
    }

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
          logger.error({ error }, "Failed to send push notification");
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
           
           // Send Web Push if enabled
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

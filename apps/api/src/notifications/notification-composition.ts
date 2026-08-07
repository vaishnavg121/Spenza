import { PrismaClient } from "@prisma/client";
import { PrismaNotificationRepository } from "./notification-repository.js";
import { NotificationService } from "./notification-service.js";

const prisma = new PrismaClient();
export const notificationService = new NotificationService(new PrismaNotificationRepository(prisma));

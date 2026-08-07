import { PrismaClient } from "@prisma/client";
import { PrismaAnalyticsRepository } from "./analytics-repository.js";
import { AnalyticsService } from "./analytics-service.js";

const prisma = new PrismaClient();
export const analyticsService = new AnalyticsService(new PrismaAnalyticsRepository(prisma));

export function createAnalyticsService(): AnalyticsService {
  return analyticsService;
}

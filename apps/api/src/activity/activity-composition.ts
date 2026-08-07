import { PrismaClient } from "@prisma/client";
import { PrismaActivityRepository } from "./activity-repository.js";
import { ActivityService } from "./activity-service.js";

const prisma = new PrismaClient();
export const activityService = new ActivityService(new PrismaActivityRepository(prisma));

export function createActivityService(): ActivityService {
  return activityService;
}

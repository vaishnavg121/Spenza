import { PrismaClient } from "@prisma/client";
import { PrismaDashboardRepository } from "./dashboard-repository.js";
import { DashboardService } from "./dashboard-service.js";

const prisma = new PrismaClient();
export const dashboardService = new DashboardService(new PrismaDashboardRepository(prisma));

export function createDashboardService(): DashboardService {
  return dashboardService;
}

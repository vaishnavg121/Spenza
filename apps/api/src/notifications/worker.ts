import { DefaultPushService } from "./push-service.js";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const pushService = new DefaultPushService(prisma);

async function runWorker() {
  console.log("Starting notification worker...");
  try {
    await pushService.processOutbox();
    console.log("Outbox processing complete.");
  } catch (error) {
    console.error("Worker failed:", error);
    process.exit(1);
  }
  process.exit(0);
}

runWorker();

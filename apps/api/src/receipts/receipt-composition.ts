import { PrismaClient } from "@prisma/client";
import { PrismaReceiptRepository } from "./receipt-repository.js";
import { ReceiptService } from "./receipt-service.js";
import { PrismaGroupRepository } from "../groups/group-repository.js";
import { MockStorageAdapter, GcsStorageAdapter, StorageAdapter } from "./storage-adapter.js";
import { logger } from "../lib/logger.js";
import { env } from "../config/env.js";

const prisma = new PrismaClient();

function createStorageAdapter(): StorageAdapter {
  const isProduction = env.NODE_ENV === "production";
  const bucketName = env.RECEIPTS_BUCKET_NAME || process.env.RECEIPTS_BUCKET_NAME;

  if (isProduction) {
    if (!bucketName) {
      throw new Error("RECEIPTS_BUCKET_NAME is not configured in the environment.");
    }
    return new GcsStorageAdapter(bucketName);
  }

  // Development and Test environments
  if (bucketName) {
    return new GcsStorageAdapter(bucketName);
  }

  logger.info("Receipt storage: mock local adapter");
  return new MockStorageAdapter();
}

export const receiptStorageAdapter = createStorageAdapter();
export const receiptService = new ReceiptService(
  new PrismaReceiptRepository(prisma),
  new PrismaGroupRepository(prisma),
  receiptStorageAdapter
);

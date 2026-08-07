import { PrismaClient } from "@prisma/client";
import { PrismaReceiptRepository } from "./receipt-repository.js";
import { ReceiptService } from "./receipt-service.js";
import { PrismaGroupRepository } from "../groups/group-repository.js";
import { MockStorageAdapter, GcsStorageAdapter, StorageAdapter } from "./storage-adapter.js";

const prisma = new PrismaClient();

function createStorageAdapter(): StorageAdapter {
  if (process.env.NODE_ENV === "test") {
    return new MockStorageAdapter();
  }

  const bucketName = process.env.RECEIPTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("RECEIPTS_BUCKET_NAME is not configured in the environment.");
  }

  return new GcsStorageAdapter(bucketName);
}

export const receiptService = new ReceiptService(
  new PrismaReceiptRepository(prisma),
  new PrismaGroupRepository(prisma),
  createStorageAdapter()
);

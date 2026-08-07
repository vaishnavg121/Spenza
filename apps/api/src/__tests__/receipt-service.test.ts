import { describe, expect, it } from "vitest";
import { ReceiptService } from "../receipts/receipt-service.js";
import { MockStorageAdapter } from "../receipts/storage-adapter.js";
import { ReceiptRepository, ReceiptRecord } from "../receipts/receipt-repository.js";
import { GroupRepository, GroupWithMembers } from "../groups/group-repository.js";
import { GroupRole } from "@prisma/client";
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "../errors/app-error.js";

class InMemoryGroupRepo implements Partial<GroupRepository> {
  async findMember(groupId: string, userId: string) {
    if (groupId === "group_1" && userId === "user_1") return {} as any;
    return null;
  }
}

class InMemoryReceiptRepo implements ReceiptRepository {
  public receipts: ReceiptRecord[] = [];

  async createPendingReceipt(data: any): Promise<ReceiptRecord> {
    const r = { id: "receipt_1", status: "PENDING", ...data, createdAt: new Date(), updatedAt: new Date() };
    this.receipts.push(r);
    return r;
  }
  async getReceiptById(receiptId: string): Promise<ReceiptRecord | null> {
    return this.receipts.find(r => r.id === receiptId) || null;
  }
  async markReceiptReady(receiptId: string): Promise<ReceiptRecord> {
    const r = this.receipts.find(r => r.id === receiptId)!;
    r.status = "READY";
    return r;
  }
  async markReceiptDeleted(receiptId: string): Promise<void> {
    const r = this.receipts.find(r => r.id === receiptId)!;
    r.status = "DELETED";
  }
  async findReceiptsByExpenseId(expenseId: string): Promise<ReceiptRecord[]> {
    return this.receipts.filter(r => r.expenseId === expenseId && r.status === "READY");
  }
}

describe("ReceiptService", () => {
  it("authorizes and creates upload request", async () => {
    const groupRepo = new InMemoryGroupRepo();
    const receiptRepo = new InMemoryReceiptRepo();
    const storage = new MockStorageAdapter();
    const service = new ReceiptService(receiptRepo, groupRepo as GroupRepository, storage);

    const res = await service.createUploadRequest("user_1", "group_1", {
      contentType: "image/jpeg",
      sizeBytes: 1000,
    });

    expect(res.uploadUrl).toContain("mock-storage");
    expect(res.objectKey).toContain("receipts/group_1/");
    expect(receiptRepo.receipts.length).toBe(1);
    expect(receiptRepo.receipts[0].status).toBe("PENDING");
  });

  it("denies upload for unauthorized user", async () => {
    const groupRepo = new InMemoryGroupRepo();
    const receiptRepo = new InMemoryReceiptRepo();
    const storage = new MockStorageAdapter();
    const service = new ReceiptService(receiptRepo, groupRepo as GroupRepository, storage);

    await expect(service.createUploadRequest("user_2", "group_1", {
      contentType: "image/jpeg",
      sizeBytes: 1000,
    })).rejects.toThrow(NotFoundError);
  });

  it("finalizes upload only for owner", async () => {
    const groupRepo = new InMemoryGroupRepo();
    const receiptRepo = new InMemoryReceiptRepo();
    const storage = new MockStorageAdapter();
    const service = new ReceiptService(receiptRepo, groupRepo as GroupRepository, storage);

    const req = await service.createUploadRequest("user_1", "group_1", {
      contentType: "image/jpeg",
      sizeBytes: 1000,
    });

    // Mock different user trying to finalize
    groupRepo.findMember = async (gid, uid) => ({}) as any; // everyone is member
    
    await expect(service.finalizeUpload("user_2", "group_1", req.id)).rejects.toThrow(ForbiddenError);

    // Correct user
    const final = await service.finalizeUpload("user_1", "group_1", req.id);
    expect(final.status).toBe("READY");
  });

  it("verifies object metadata before finalizing", async () => {
    const groupRepo = new InMemoryGroupRepo();
    const receiptRepo = new InMemoryReceiptRepo();
    const storage = new MockStorageAdapter();
    const service = new ReceiptService(receiptRepo, groupRepo as GroupRepository, storage);

    const req = await service.createUploadRequest("user_1", "group_1", {
      contentType: "image/jpeg",
      sizeBytes: 1000,
    });

    // Simulate incorrect upload by deleting object from storage
    await storage.deleteObject(req.objectKey);

    await expect(service.finalizeUpload("user_1", "group_1", req.id)).rejects.toThrow(UnprocessableEntityError);
  });
});

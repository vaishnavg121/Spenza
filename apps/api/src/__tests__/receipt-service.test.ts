import { describe, expect, it } from "vitest";
import { CreateUploadRequestSchema } from "@spenza/contracts";
import type { GroupMember } from "@prisma/client";
import { ReceiptService } from "../receipts/receipt-service.js";
import { MockStorageAdapter } from "../receipts/storage-adapter.js";
import type { ReceiptRepository, ReceiptRecord } from "../receipts/receipt-repository.js";
import type { GroupRepository } from "../groups/group-repository.js";
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "../errors/app-error.js";

const groupMember: GroupMember = {
  id: "member_1",
  groupId: "group_1",
  userId: "user_1",
  role: "ADMIN",
  isFavorite: false,
  createdAt: new Date("2026-08-09T00:00:00.000Z"),
};

class InMemoryGroupRepo implements Pick<GroupRepository, "findMember"> {
  async findMember(groupId: string, userId: string) {
    return groupId === "group_1" && userId === "user_1" ? groupMember : null;
  }
}

class InMemoryReceiptRepo implements ReceiptRepository {
  readonly receipts: ReceiptRecord[] = [];

  async expenseExistsInGroup(expenseId: string, groupId: string): Promise<boolean> {
    return expenseId === "expense_1" && groupId === "group_1";
  }

  async createPendingReceipt(data: Omit<ReceiptRecord, "id" | "createdAt" | "updatedAt" | "status">): Promise<ReceiptRecord> {
    const receipt: ReceiptRecord = {
      id: `receipt_${this.receipts.length + 1}`,
      status: "PENDING",
      ...data,
      createdAt: new Date("2026-08-09T00:00:00.000Z"),
      updatedAt: new Date("2026-08-09T00:00:00.000Z"),
    };
    this.receipts.push(receipt);
    return receipt;
  }

  async getReceiptById(receiptId: string) {
    return this.receipts.find((receipt) => receipt.id === receiptId) ?? null;
  }

  async markReceiptReady(receiptId: string): Promise<ReceiptRecord> {
    const receipt = this.receipts.find((candidate) => candidate.id === receiptId);
    if (!receipt) throw new Error("Missing test receipt");
    receipt.status = "READY";
    return receipt;
  }

  async markReceiptDeleted(receiptId: string): Promise<void> {
    const receipt = this.receipts.find((candidate) => candidate.id === receiptId);
    if (receipt) receipt.status = "DELETED";
  }

  async findReceiptsByExpenseId(expenseId: string): Promise<ReceiptRecord[]> {
    return this.receipts.filter((receipt) => receipt.expenseId === expenseId && receipt.status === "READY");
  }
}

function setup() {
  const receiptRepository = new InMemoryReceiptRepo();
  const storage = new MockStorageAdapter();
  const service = new ReceiptService(
    receiptRepository,
    new InMemoryGroupRepo() as GroupRepository,
    storage,
  );
  return { receiptRepository, storage, service };
}

function uploadToken(url: string): string {
  const token = url.split("/").at(-1);
  if (!token) throw new Error("Missing test upload token");
  return token;
}

describe("ReceiptService", () => {
  it("accepts a real local upload, finalizes it, and lists it for the expense", async () => {
    const { receiptRepository, storage, service } = setup();
    const bytes = Buffer.from("valid-image");
    const request = await service.createUploadRequest("user_1", "group_1", {
      expenseId: "expense_1",
      contentType: "image/png",
      sizeBytes: bytes.byteLength,
    });

    expect(storage.acceptUpload(uploadToken(request.uploadUrl), "image/png", bytes)).toEqual({ ok: true });
    const finalized = await service.finalizeUpload("user_1", "group_1", request.id);
    expect(finalized).toMatchObject({ expenseId: "expense_1", status: "READY" });
    expect(await service.listExpenseReceipts("user_1", "group_1", "expense_1")).toEqual([finalized]);
    expect(receiptRepository.receipts).toHaveLength(1);
  });

  it("rejects invalid MIME types and oversized files at the contract boundary", () => {
    expect(CreateUploadRequestSchema.safeParse({ expenseId: "expense_1", contentType: "application/pdf", sizeBytes: 100 }).success).toBe(false);
    expect(CreateUploadRequestSchema.safeParse({ expenseId: "expense_1", contentType: "image/png", sizeBytes: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it("hides unauthorized groups and expenses", async () => {
    const { service } = setup();
    await expect(service.createUploadRequest("user_2", "group_1", {
      expenseId: "expense_1", contentType: "image/jpeg", sizeBytes: 1,
    })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.createUploadRequest("user_1", "group_1", {
      expenseId: "expense_outside", contentType: "image/jpeg", sizeBytes: 1,
    })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("requires the uploader to finalize and requires uploaded bytes", async () => {
    const { receiptRepository, storage, service } = setup();
    const request = await service.createUploadRequest("user_1", "group_1", {
      expenseId: "expense_1", contentType: "image/jpeg", sizeBytes: 4,
    });
    const permissiveGroupRepository = new InMemoryGroupRepo();
    permissiveGroupRepository.findMember = async () => groupMember;

    const ownerCheckedService = new ReceiptService(
      receiptRepository,
      permissiveGroupRepository as GroupRepository,
      storage,
    );
    await expect(ownerCheckedService.finalizeUpload("user_2", "group_1", request.id)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(service.finalizeUpload("user_1", "group_1", request.id)).rejects.toBeInstanceOf(UnprocessableEntityError);
  });

  it("enforces upload metadata and one-time upload tickets", async () => {
    const { storage, service } = setup();
    const request = await service.createUploadRequest("user_1", "group_1", {
      expenseId: "expense_1", contentType: "image/webp", sizeBytes: 4,
    });
    const token = uploadToken(request.uploadUrl);
    expect(storage.acceptUpload(token, "image/png", Buffer.from("1234"))).toEqual({ ok: false, reason: "CONTENT_TYPE" });
    expect(storage.acceptUpload(token, "image/webp", Buffer.from("123"))).toEqual({ ok: false, reason: "SIZE" });
    expect(storage.acceptUpload(token, "image/webp", Buffer.from("1234"))).toEqual({ ok: true });
    expect(storage.acceptUpload(token, "image/webp", Buffer.from("1234"))).toEqual({ ok: false, reason: "NOT_FOUND" });
  });
});

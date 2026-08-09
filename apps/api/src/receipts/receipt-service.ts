import { randomUUID } from "node:crypto";
import {
  CreateUploadRequestInput,
  UploadRequestResponseSchema,
  ReceiptResponseSchema,
  type ReceiptResponse,
  type UploadRequestResponse,
} from "@spenza/contracts";
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from "../errors/app-error.js";
import { GroupRepository } from "../groups/group-repository.js";
import { ReceiptRepository, type ReceiptRecord } from "./receipt-repository.js";
import { StorageAdapter } from "./storage-adapter.js";

export function serializeReceipt(record: ReceiptRecord): ReceiptResponse {
  return ReceiptResponseSchema.parse({
    id: record.id,
    groupId: record.groupId,
    expenseId: record.expenseId,
    uploaderId: record.uploaderId,
    objectKey: record.objectKey,
    contentType: record.contentType,
    sizeBytes: record.sizeBytes,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });
}

export class ReceiptService {
  constructor(
    private readonly repository: ReceiptRepository,
    private readonly groupRepository: GroupRepository,
    private readonly storageAdapter: StorageAdapter
  ) {}

  async createUploadRequest(
    actorUserId: string,
    groupId: string,
    input: CreateUploadRequestInput
  ): Promise<UploadRequestResponse> {
    const member = await this.groupRepository.findMember(groupId, actorUserId);
    if (!member) {
      throw new NotFoundError("Group not found");
    }

    if (!await this.repository.expenseExistsInGroup(input.expenseId, groupId)) {
      throw new NotFoundError("Expense not found");
    }

    const objectKey = `receipts/${groupId}/${randomUUID()}`;
    const signedUpload = await this.storageAdapter.generateUploadUrl(objectKey, input.contentType, input.sizeBytes);

    const record = await this.repository.createPendingReceipt({
      groupId,
      uploaderId: actorUserId,
      objectKey,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      expenseId: input.expenseId,
    });

    return UploadRequestResponseSchema.parse({
      id: record.id,
      uploadUrl: signedUpload.uploadUrl,
      objectKey: signedUpload.objectKey,
      method: signedUpload.method,
    });
  }

  async finalizeUpload(actorUserId: string, groupId: string, receiptId: string): Promise<ReceiptResponse> {
    const member = await this.groupRepository.findMember(groupId, actorUserId);
    if (!member) {
      throw new NotFoundError("Group not found");
    }

    const receipt = await this.repository.getReceiptById(receiptId);
    if (!receipt || receipt.groupId !== groupId) {
      throw new NotFoundError("Receipt not found");
    }

    if (receipt.uploaderId !== actorUserId) {
      throw new ForbiddenError("You can only finalize your own uploads");
    }

    if (!receipt.objectKey.startsWith(`receipts/${groupId}/`)) {
      throw new UnprocessableEntityError("Receipt object boundary is invalid", "RECEIPT_OBJECT_BOUNDARY_INVALID");
    }

    if (receipt.status === "READY") {
      return serializeReceipt(receipt);
    }

    const isValid = await this.storageAdapter.verifyObjectMetadata(receipt.objectKey, receipt.contentType, receipt.sizeBytes);
    if (!isValid) {
      throw new UnprocessableEntityError("Object metadata verification failed", "UPLOAD_VERIFICATION_FAILED");
    }

    const updated = await this.repository.markReceiptReady(receiptId);
    return serializeReceipt(updated);
  }

  async getReceiptUrl(actorUserId: string, groupId: string, receiptId: string): Promise<string> {
    const member = await this.groupRepository.findMember(groupId, actorUserId);
    if (!member) {
      throw new NotFoundError("Group not found");
    }

    const receipt = await this.repository.getReceiptById(receiptId);
    if (!receipt || receipt.groupId !== groupId || receipt.status !== "READY") {
      throw new NotFoundError("Receipt not found");
    }

    if (!receipt.objectKey.startsWith(`receipts/${groupId}/`)) {
      throw new NotFoundError("Receipt not found");
    }

    return this.storageAdapter.generateDownloadUrl(receipt.objectKey);
  }

  async listExpenseReceipts(actorUserId: string, groupId: string, expenseId: string): Promise<ReceiptResponse[]> {
    const member = await this.groupRepository.findMember(groupId, actorUserId);
    if (!member || !await this.repository.expenseExistsInGroup(expenseId, groupId)) {
      throw new NotFoundError("Expense not found");
    }

    const receipts = await this.repository.findReceiptsByExpenseId(expenseId);
    return receipts
      .filter((receipt) => receipt.groupId === groupId && receipt.objectKey.startsWith(`receipts/${groupId}/`))
      .map(serializeReceipt);
  }
}

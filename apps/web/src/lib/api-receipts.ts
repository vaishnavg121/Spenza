import { apiFetch } from "./api-client";
import type { CreateUploadRequestInput, UploadRequestResponse, ReceiptResponse } from "@spenza/contracts";

export async function createUploadRequestApi(groupId: string, data: CreateUploadRequestInput): Promise<UploadRequestResponse> {
  return apiFetch<UploadRequestResponse>(`/v1/groups/${groupId}/receipts/upload-requests`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function finalizeUploadApi(groupId: string, receiptId: string): Promise<ReceiptResponse> {
  return apiFetch<ReceiptResponse>(`/v1/groups/${groupId}/receipts/${receiptId}/finalize`, {
    method: "POST",
  });
}

export async function getReceiptUrlApi(groupId: string, receiptId: string): Promise<{ url: string }> {
  return apiFetch<{ url: string }>(`/v1/groups/${groupId}/receipts/${receiptId}/url`);
}

import { apiFetch } from "./api-client";
import type { CreateUploadRequestInput, UploadRequestResponse, ReceiptResponse } from "@spenza/contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function resolveStorageUrl(url: string): string {
  return new URL(url, API_BASE_URL).toString();
}

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

export async function uploadReceiptBinaryApi(request: UploadRequestResponse, file: File): Promise<void> {
  const response = await fetch(resolveStorageUrl(request.uploadUrl), {
    method: request.method,
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!response.ok) {
    throw new Error("Receipt storage upload failed");
  }
}

export async function listExpenseReceiptsApi(groupId: string, expenseId: string): Promise<ReceiptResponse[]> {
  return apiFetch<ReceiptResponse[]>(`/v1/groups/${groupId}/expenses/${expenseId}/receipts`);
}

export async function getReceiptUrlApi(groupId: string, receiptId: string): Promise<{ url: string }> {
  const result = await apiFetch<{ url: string }>(`/v1/groups/${groupId}/receipts/${receiptId}/url`);
  return { url: resolveStorageUrl(result.url) };
}

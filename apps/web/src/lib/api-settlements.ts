import { apiFetch, apiFetchPage } from "./api-client";
import type { 
  CreateSettlementInput, 
  SettlementResponse, 
  SettlementPage 
} from "@spenza/contracts";

export async function createSettlementApi(
  groupId: string, 
  data: CreateSettlementInput, 
  idempotencyKey: string
): Promise<SettlementResponse> {
  return apiFetch<SettlementResponse>(`/v1/groups/${groupId}/settlements`, {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(data),
  });
}

export async function fetchSettlementsApi(groupId: string, cursor?: string): Promise<SettlementPage> {
  const searchParams = new URLSearchParams();
  if (cursor) {
      searchParams.set("cursor", cursor);
  }
  const queryString = searchParams.toString();
  const path = `/v1/groups/${groupId}/settlements${queryString ? `?${queryString}` : ""}`;
  return apiFetchPage<SettlementPage>(path);
}

export async function reverseSettlementApi(
  groupId: string, 
  settlementId: string, 
  idempotencyKey: string
): Promise<SettlementResponse> {
  return apiFetch<SettlementResponse>(`/v1/groups/${groupId}/settlements/${settlementId}/reverse`, {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
}

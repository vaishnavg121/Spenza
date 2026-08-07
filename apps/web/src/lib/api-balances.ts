import { apiFetch } from "./api-client";
import type { BalanceResponse } from "@spenza/contracts";

export async function fetchBalancesApi(groupId: string): Promise<BalanceResponse> {
  return apiFetch<BalanceResponse>(`/v1/groups/${groupId}/balances`);
}

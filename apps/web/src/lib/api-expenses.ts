import { apiFetch } from "./api-client";
import type { CreateExpenseInput, UpdateExpenseInput, ExpenseResponse, ExpensePage } from "@spenza/contracts";

export async function createExpenseApi(groupId: string, data: CreateExpenseInput, idempotencyKey: string): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/v1/groups/${groupId}/expenses`, {
    method: "POST",
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(data),
  });
}

export async function fetchExpensesApi(groupId: string, cursor?: string): Promise<ExpensePage> {
  const url = new URL(`/v1/groups/${groupId}/expenses`, window.location.origin); // the apiFetch handles absolute vs relative differently probably, but let's see apiFetch implementation
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }
  // Wait, apiFetch takes a path. So:
  const searchParams = new URLSearchParams();
  if (cursor) {
      searchParams.set("cursor", cursor);
  }
  const queryString = searchParams.toString();
  const path = `/v1/groups/${groupId}/expenses${queryString ? `?${queryString}` : ""}`;
  return apiFetch<ExpensePage>(path);
}

export async function fetchExpenseByIdApi(groupId: string, expenseId: string): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/v1/groups/${groupId}/expenses/${expenseId}`);
}

export async function updateExpenseApi(groupId: string, expenseId: string, data: UpdateExpenseInput): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/v1/groups/${groupId}/expenses/${expenseId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

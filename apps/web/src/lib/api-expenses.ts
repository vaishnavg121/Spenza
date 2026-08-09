import { apiFetch, apiFetchPage } from "./api-client";
import type { CreateExpenseInput, UpdateExpenseInput, VoidExpenseInput, ExpenseResponse, ExpensePage } from "@spenza/contracts";

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
  const searchParams = new URLSearchParams();
  if (cursor) {
      searchParams.set("cursor", cursor);
  }
  const queryString = searchParams.toString();
  const path = `/v1/groups/${groupId}/expenses${queryString ? `?${queryString}` : ""}`;
  return apiFetchPage<ExpensePage>(path);
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

export async function voidExpenseApi(groupId: string, expenseId: string, data: VoidExpenseInput): Promise<ExpenseResponse> {
  return apiFetch<ExpenseResponse>(`/v1/groups/${groupId}/expenses/${expenseId}/void`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

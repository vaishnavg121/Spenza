import { apiFetch } from "./api-client";
import type { ExpenseSearchPage } from "@spenza/contracts";

export async function fetchExpenseSearchApi(params: Record<string, string>): Promise<ExpenseSearchPage> {
  const searchParams = new URLSearchParams(params);
  const queryString = searchParams.toString();
  const path = `/v1/search/expenses${queryString ? `?${queryString}` : ""}`;
  return apiFetch<ExpenseSearchPage>(path);
}

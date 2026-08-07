import { apiFetch } from "./api-client";
import type { DashboardResponse } from "@spenza/contracts";

export async function fetchDashboardApi(): Promise<DashboardResponse> {
  return apiFetch<DashboardResponse>("/v1/dashboard");
}

import { apiFetch } from "./api-client";
import type { AnalyticsResponse } from "@spenza/contracts";

export async function fetchAnalyticsApi(params?: Record<string, string>): Promise<AnalyticsResponse> {
  const searchParams = new URLSearchParams(params || {});
  const queryString = searchParams.toString();
  const path = `/v1/analytics${queryString ? `?${queryString}` : ""}`;
  return apiFetch<AnalyticsResponse>(path);
}

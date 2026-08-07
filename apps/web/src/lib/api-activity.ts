import { apiFetch } from "./api-client";
import type { ActivityPage } from "@spenza/contracts";

export async function fetchActivityApi(cursor?: string): Promise<ActivityPage> {
  const searchParams = new URLSearchParams();
  if (cursor) {
    searchParams.set("cursor", cursor);
  }
  const queryString = searchParams.toString();
  const path = `/v1/activity${queryString ? `?${queryString}` : ""}`;
  return apiFetch<ActivityPage>(path);
}

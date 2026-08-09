import { apiFetch } from "./api-client";
import type { Profile } from "@spenza/contracts";

export async function fetchProfileApi(): Promise<Profile> {
  return apiFetch<Profile>("/v1/me");
}

"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback } from "react";
import { apiFetch } from "./api-client";

export function useApiClient() {
  const { getToken } = useAuth();

  const fetchWithAuth = useCallback(
    async <T>(path: string, options: RequestInit = {}): Promise<T> => {
      let token: string | null = null;
      try {
        token = await getToken();
      } catch {
        // Token acquisition failure
      }
      return apiFetch<T>(path, options, token);
    },
    [getToken]
  );

  return fetchWithAuth;
}

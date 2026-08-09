const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function apiRequest(
  path: string,
  options: RequestInit = {},
  explicitToken?: string | null
): Promise<unknown> {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, API_BASE_URL);

  // Security check: Only attach Authorization header if targeting configured API origin
  const apiOrigin = new URL(API_BASE_URL).origin;
  const isTargetingApiOrigin = url.origin === apiOrigin;

  let token = explicitToken;

  // If no explicit token provided, try obtaining fresh Clerk token from window.Clerk session
  if (!token && typeof window !== "undefined") {
    const windowWithClerk = window as unknown as {
      Clerk?: {
        session?: {
          getToken: () => Promise<string | null>;
        };
      };
    };
    if (windowWithClerk.Clerk?.session?.getToken) {
      try {
        token = await windowWithClerk.Clerk.session.getToken();
      } catch {
        // Token acquisition failure degrades to unauthenticated request
      }
    }
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (token && isTargetingApiOrigin) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers,
    credentials: "include",
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = body?.error?.message || `API request failed with status ${res.status}`;
    throw new Error(errorMsg);
  }

  return body;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  explicitToken?: string | null
): Promise<T> {
  const body = await apiRequest(path, options, explicitToken);
  return (body as { data: T }).data;
}

export async function apiFetchPage<T>(
  path: string,
  options: RequestInit = {},
  explicitToken?: string | null
): Promise<T> {
  return apiRequest(path, options, explicitToken) as Promise<T>;
}

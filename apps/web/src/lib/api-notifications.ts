import { apiFetch } from "./api-client";
import type { PushSubscriptionInput, NotificationPage } from "@spenza/contracts";

export async function subscribeToPushApi(data: PushSubscriptionInput): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/v1/push-subscriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function unsubscribeFromPushApi(subscriptionId: string, endpoint?: string): Promise<void> {
  const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : "";
  return apiFetch<void>(`/v1/push-subscriptions/${subscriptionId}${query}`, {
    method: "DELETE",
  });
}

export async function fetchNotificationsApi(cursor?: string): Promise<NotificationPage> {
  const searchParams = new URLSearchParams();
  if (cursor) {
    searchParams.set("cursor", cursor);
  }
  const queryString = searchParams.toString();
  const path = `/v1/notifications${queryString ? `?${queryString}` : ""}`;
  
  // Note: the notification API returns { data: ..., page: ..., unreadCount: ... }
  // at the root, which gets returned as T by apiFetch because apiFetch unpacks { data: T } 
  // Wait, my apiFetch currently unpacks body.data! 
  // If apiFetch assumes `{ data: T }`, the router MUST return `res.json({ data: NotificationPage })`
  return apiFetch<NotificationPage>(path);
}

export async function markNotificationReadApi(notificationId?: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>("/v1/notifications/mark-read", {
    method: "POST",
    body: JSON.stringify({ notificationId }),
  });
}

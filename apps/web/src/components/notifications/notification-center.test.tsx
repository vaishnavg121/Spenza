import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationCenter } from "./notification-center";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/lib/api-notifications", () => ({
  fetchNotificationsApi: vi.fn().mockResolvedValue({ data: [], unreadCount: 0 }),
  markNotificationReadApi: vi.fn(),
}));

vi.mock("./push-subscribe-button", () => ({
  PushSubscribeButton: () => null,
}));

afterEach(() => {
  document.body.replaceChildren();
});

describe("NotificationCenter", () => {
  it("renders exactly one interactive button for the menu trigger", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <NotificationCenter />
        </QueryClientProvider>,
      );
    });

    const trigger = container.querySelector('[data-slot="dropdown-menu-trigger"]');

    expect(trigger?.tagName).toBe("BUTTON");
    expect(container.querySelectorAll('[data-slot="dropdown-menu-trigger"]')).toHaveLength(1);
    expect(trigger?.querySelector("button, a")).toBeNull();
    expect(container.querySelector("button button, button a, a button")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    queryClient.clear();
  });
});

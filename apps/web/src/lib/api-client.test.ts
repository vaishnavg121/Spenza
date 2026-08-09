import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch, apiFetchPage } from "./api-client";

describe("API response handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("unwraps a single-resource success envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: { id: "group_1" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch<{ id: string }>("/v1/groups/group_1", {}, "test-token"))
      .resolves.toEqual({ id: "group_1" });
  });

  it("preserves the documented top-level pagination metadata", async () => {
    const page = {
      data: [],
      page: { nextCursor: null, hasMore: false },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue(page),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetchPage<typeof page>("/v1/groups/group_1/expenses", {}, "test-token"))
      .resolves.toEqual(page);
  });
});

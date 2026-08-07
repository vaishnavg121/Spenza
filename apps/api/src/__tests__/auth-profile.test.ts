import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type express from "express";
import { UpdateProfileSchema } from "@spenza/contracts";

const getAuth = vi.fn();
vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth,
}));

let app: express.Application;
beforeAll(async () => { ({ app } = await import("../app.js")); });

describe("Clerk authentication and deferred profiles", () => {
  beforeEach(() => getAuth.mockReturnValue({ isAuthenticated: false, userId: null }));

  it("keeps health routes public", async () => {
    expect((await request(app).get("/health")).status).toBe(200);
    expect((await request(app).get("/v1/health")).status).toBe(200);
  });

  it.each(["missing", "invalid"])("rejects %s authentication", async () => {
    const res = await request(app).get("/v1/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("passes a verified Clerk subject to a protected handler before fail-closed identity resolution", async () => {
    getAuth.mockReturnValue({ isAuthenticated: true, userId: "user_clerk_123" });
    const res = await request(app).get("/v1/me");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("IDENTITY_LINK_REQUIRED");
  });

  it("validates PATCH fields before identity resolution", async () => {
    getAuth.mockReturnValue({ isAuthenticated: true, userId: "user_clerk_123" });
    const valid = await request(app).patch("/v1/me").send({ name: "Ada", currency: "INR" });
    expect(valid.status).toBe(409);
    const invalid = await request(app).patch("/v1/me").send({ id: "forbidden" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("profile contracts", () => {
  it("accepts editable fields", () => expect(UpdateProfileSchema.safeParse({ name: "Ada", theme: "dark" }).success).toBe(true));
  it("rejects unknown and identity fields", () => {
    expect(UpdateProfileSchema.safeParse({ id: "user_1" }).success).toBe(false);
    expect(UpdateProfileSchema.safeParse({ email: "ada@example.com" }).success).toBe(false);
  });
});

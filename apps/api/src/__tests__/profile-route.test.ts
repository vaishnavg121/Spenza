import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createProfileRouter } from "../routes/profile.js";
import { IdentityConflictError, IdentityService } from "../identity/identity-service.js";

const { repository, service } = vi.hoisted(() => ({
  repository: { updateProfile: vi.fn() },
  service: { resolve: vi.fn() },
}));

vi.mock("../identity/clerk-identity.js", () => ({
  getTrustedClerkIdentity: vi.fn().mockResolvedValue({
    clerkSubjectId: "user_1",
    primaryVerifiedEmail: "ada@example.com",
  }),
}));

const user = {
  id: "internal_1",
  name: "Ada",
  username: null,
  email: "ada@example.com",
  clerkSubjectId: "user_1",
  emailVerified: false,
  image: null,
  phone: null,
  currency: "USD",
  theme: "system",
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("../identity/identity-composition.js", () => ({
  identityRepository: repository,
  identityService: service,
}));

function app(actor = "user_1") {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    if (actor) req.actor = { clerkSubject: actor };
    next();
  });
  instance.use(createProfileRouter(service as unknown as IdentityService));
  instance.use(
    (
      err: { statusCode?: number; code?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => res.status(err.statusCode ?? 500).json({ error: { code: err.code } })
  );
  return instance;
}

describe("profile routes", () => {
  beforeEach(() => {
    vi.mocked(service.resolve).mockResolvedValue({ kind: "resolved", user });
    repository.updateProfile.mockResolvedValue(user);
  });

  it.each(["mapped user", "new safe user"])("GET resolves %s", async () =>
    expect((await request(app()).get("/v1/me")).status).toBe(200)
  );

  it("returns reconciliation", async () => {
    vi.mocked(service.resolve).mockResolvedValue({
      kind: "legacy-reconciliation-required",
    });
    const r = await request(app()).get("/v1/me");
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe("LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
  });

  it("returns conflict", async () => {
    vi.mocked(service.resolve).mockRejectedValue(new IdentityConflictError());
    const r = await request(app()).get("/v1/me");
    expect(r.body.error.code).toBe("IDENTITY_CONFLICT");
  });

  it("updates allowed fields", async () =>
    expect(
      (await request(app()).patch("/v1/me").send({ name: "Grace" })).status
    ).toBe(200));

  it.each([
    { id: "x" },
    { clerkSubjectId: "x" },
    { email: "x@y.com" },
    { unknown: "x" },
  ])("rejects forbidden fields", async (body) =>
    expect((await request(app()).patch("/v1/me").send(body)).status).toBe(400)
  );
});

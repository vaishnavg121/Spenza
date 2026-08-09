import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../middleware/error-handler.js";
import { createGroupInviteRouter, type GroupInviteRouteService } from "../routes/group-invites.js";

const token = `${"a".repeat(80)}.${"b".repeat(43)}`;
const createInvite = vi.fn<GroupInviteRouteService["createInvite"]>();
const revokeInvite = vi.fn<GroupInviteRouteService["revokeInvite"]>();
const previewInvite = vi.fn<GroupInviteRouteService["previewInvite"]>();
const acceptInvite = vi.fn<GroupInviteRouteService["acceptInvite"]>();
const service: GroupInviteRouteService = { createInvite, revokeInvite, previewInvite, acceptInvite };

function app(authenticated = true) {
  const instance = express();
  instance.use(express.json());
  instance.use((request, _response, next) => {
    request.id = "req_invite_test";
    if (authenticated) request.actor = { clerkSubject: "clerk_actor" };
    next();
  });
  instance.use(createGroupInviteRouter(service, async () => "user_1"));
  instance.use(errorHandler);
  return instance;
}

describe("group invite routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps invite preview public and requires authentication for acceptance", async () => {
    previewInvite.mockResolvedValue({
      groupId: "group_1", groupName: "Trip", currency: "INR", inviterId: "user_1", inviterName: "Inviter", expiresAt: "2026-08-16T00:00:00.000Z",
    });
    expect((await request(app(false)).get(`/v1/group-invites/${token}`)).status).toBe(200);
    expect((await request(app(false)).post(`/v1/group-invites/${token}/accept`).send({})).status).toBe(401);
  });

  it("rejects client-controlled membership roles", async () => {
    const response = await request(app()).post(`/v1/group-invites/${token}/accept`).send({ role: "ADMIN" });
    expect(response.status).toBe(400);
    expect(acceptInvite).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { createGroupRouter } from "../routes/groups.js";
import { GroupService } from "../groups/group-service.js";
import { ForbiddenError, NotFoundError, ConflictError } from "../errors/app-error.js";

const { repository, service } = vi.hoisted(() => ({
  repository: {
    createGroup: vi.fn(),
    findGroupById: vi.fn(),
    findGroupsByUserId: vi.fn(),
    updateGroup: vi.fn(),
    findMember: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    countAdmins: vi.fn(),
    findUserByEmail: vi.fn(),
    createActivity: vi.fn(),
  },
  service: {
    createGroup: vi.fn(),
    getUserGroups: vi.fn(),
    getGroupById: vi.fn(),
    updateGroup: vi.fn(),
    addGroupMember: vi.fn(),
    removeGroupMember: vi.fn(),
  },
}));

vi.mock("../identity/clerk-identity.js", () => ({
  getTrustedClerkIdentity: vi.fn().mockImplementation(async (id: string) => ({
    clerkSubjectId: id,
    primaryVerifiedEmail: `${id}@example.com`,
  })),
}));

vi.mock("../identity/identity-composition.js", () => ({
  identityService: {
    resolve: vi.fn().mockImplementation(async (trusted: { clerkSubjectId: string }) => ({
      kind: "resolved",
      user: {
        id: `internal_${trusted.clerkSubjectId}`,
        name: "Test User",
        email: `${trusted.clerkSubjectId}@example.com`,
        clerkSubjectId: trusted.clerkSubjectId,
      },
    })),
  },
}));

function app(actorClerkSubject = "clerk_user_1") {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    if (actorClerkSubject) {
      req.actor = { clerkSubject: actorClerkSubject };
    }
    next();
  });
  instance.use(createGroupRouter(service as unknown as GroupService));
  instance.use(
    (
      err: { statusCode?: number; code?: string; message?: string },
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => res.status(err.statusCode ?? 500).json({ error: { code: err.code || "INTERNAL_ERROR", message: err.message } })
  );
  return instance;
}

const mockGroupResponse = {
  id: "grp_123",
  name: "Goa Trip",
  description: "Vacation expenses",
  imageUrl: null,
  currency: "INR",
  inviteLink: null,
  isArchived: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  members: [
    {
      id: "mem_1",
      groupId: "grp_123",
      userId: "internal_clerk_user_1",
      role: "ADMIN" as const,
      isFavorite: false,
      createdAt: new Date().toISOString(),
      user: {
        id: "internal_clerk_user_1",
        name: "Test User",
        email: "clerk_user_1@example.com",
        image: null,
      },
    },
  ],
};

describe("Group & Membership API Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /v1/groups requires authentication (401)", async () => {
    const unauthApp = app("");
    const res = await request(unauthApp).get("/v1/groups");
    expect(res.status).toBe(401);
  });

  it("POST /v1/groups creates a group and assigns creator as admin", async () => {
    vi.mocked(service.createGroup).mockResolvedValue(mockGroupResponse);

    const res = await request(app("clerk_user_1"))
      .post("/v1/groups")
      .send({ name: "Goa Trip", description: "Vacation expenses", currency: "INR" });

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBe("grp_123");
    expect(service.createGroup).toHaveBeenCalledWith("internal_clerk_user_1", {
      name: "Goa Trip",
      description: "Vacation expenses",
      currency: "INR",
    });
  });

  it("POST /v1/groups rejects malformed payload (400)", async () => {
    const res = await request(app("clerk_user_1")).post("/v1/groups").send({ name: "a" }); // name too short
    expect(res.status).toBe(400);
  });

  it("GET /v1/groups lists only groups visible to authenticated user", async () => {
    vi.mocked(service.getUserGroups).mockResolvedValue([mockGroupResponse]);

    const res = await request(app("clerk_user_1")).get("/v1/groups");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(service.getUserGroups).toHaveBeenCalledWith("internal_clerk_user_1");
  });

  it("GET /v1/groups/:groupId returns group for authorized member", async () => {
    vi.mocked(service.getGroupById).mockResolvedValue(mockGroupResponse);

    const res = await request(app("clerk_user_1")).get("/v1/groups/grp_123");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Goa Trip");
  });

  it("GET /v1/groups/:groupId hides non-member groups with 404", async () => {
    vi.mocked(service.getGroupById).mockRejectedValue(new NotFoundError("Group not found"));

    const res = await request(app("clerk_user_2")).get("/v1/groups/grp_123");
    expect(res.status).toBe(404);
  });

  it("PATCH /v1/groups/:groupId updates group for authorized admin", async () => {
    vi.mocked(service.updateGroup).mockResolvedValue({ ...mockGroupResponse, name: "Goa Beach Trip" });

    const res = await request(app("clerk_user_1"))
      .patch("/v1/groups/grp_123")
      .send({ name: "Goa Beach Trip" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Goa Beach Trip");
  });

  it("PATCH /v1/groups/:groupId rejects updates for non-admins (403)", async () => {
    vi.mocked(service.updateGroup).mockRejectedValue(new ForbiddenError("Only group administrators can update group details"));

    const res = await request(app("clerk_user_member"))
      .patch("/v1/groups/grp_123")
      .send({ name: "Renamed Group" });

    expect(res.status).toBe(403);
  });

  it("POST /v1/groups/:groupId/members adds a member by email", async () => {
    vi.mocked(service.addGroupMember).mockResolvedValue(mockGroupResponse);

    const res = await request(app("clerk_user_1"))
      .post("/v1/groups/grp_123/members")
      .send({ email: "friend@example.com", role: "MEMBER" });

    expect(res.status).toBe(200);
    expect(service.addGroupMember).toHaveBeenCalledWith("internal_clerk_user_1", "grp_123", {
      email: "friend@example.com",
      role: "MEMBER",
    });
  });

  it("DELETE /v1/groups/:groupId/members/:userId allows member removal", async () => {
    vi.mocked(service.removeGroupMember).mockResolvedValue(undefined);

    const res = await request(app("clerk_user_1")).delete("/v1/groups/grp_123/members/mem_2");
    expect(res.status).toBe(204);
    expect(service.removeGroupMember).toHaveBeenCalledWith("internal_clerk_user_1", "grp_123", "mem_2");
  });

  it("POST /v1/groups/:groupId/leave allows member to leave", async () => {
    vi.mocked(service.removeGroupMember).mockResolvedValue(undefined);

    const res = await request(app("clerk_user_1")).post("/v1/groups/grp_123/leave");
    expect(res.status).toBe(204);
    expect(service.removeGroupMember).toHaveBeenCalledWith("internal_clerk_user_1", "grp_123", "internal_clerk_user_1");
  });

  it("POST /v1/groups/:groupId/leave rejects sole admin departure (409)", async () => {
    vi.mocked(service.removeGroupMember).mockRejectedValue(
      new ConflictError("Cannot leave group as the sole administrator. Appoint another admin first.")
    );

    const res = await request(app("clerk_user_1")).post("/v1/groups/grp_123/leave");
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });
});

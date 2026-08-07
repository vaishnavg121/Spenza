import { Router, Request, Response, NextFunction } from "express";
import { CreateGroupSchema, UpdateGroupSchema, AddGroupMemberSchema } from "@spenza/contracts";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { groupService as defaultGroupService } from "../groups/group-composition.js";
import { GroupService } from "../groups/group-service.js";
import { UnauthorizedError, ConflictError, ValidationError } from "../errors/app-error.js";

async function resolveInternalUserId(req: Request): Promise<string> {
  if (!req.actor?.clerkSubject) {
    throw new UnauthorizedError("Authentication required");
  }
  const trusted = await getTrustedClerkIdentity(req.actor.clerkSubject);
  const resolved = await identityService.resolve(trusted);
  if (resolved.kind === "legacy-reconciliation-required") {
    throw new ConflictError("Legacy identity reconciliation required", "LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
  }
  return resolved.user.id;
}

export function createGroupRouter(groupService: GroupService = defaultGroupService): Router {
  const router = Router();

  // POST /v1/groups - Create a group
  router.post("/v1/groups", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const parsed = CreateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ValidationError(
            "Invalid group payload",
            parsed.error.issues.map((issue) => ({
              path: issue.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
              code: issue.code,
              message: issue.message,
            }))
          )
        );
      }
      const group = await groupService.createGroup(actorUserId, parsed.data);
      res.status(201).json({ data: group });
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/groups - List user's groups
  router.get("/v1/groups", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const groups = await groupService.getUserGroups(actorUserId);
      res.status(200).json({ data: groups });
    } catch (error) {
      next(error);
    }
  });

  // GET /v1/groups/:groupId - Get group details
  router.get("/v1/groups/:groupId", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const groupId = String(req.params.groupId);
      const group = await groupService.getGroupById(actorUserId, groupId);
      res.status(200).json({ data: group });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /v1/groups/:groupId - Update group details
  router.patch("/v1/groups/:groupId", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const groupId = String(req.params.groupId);
      const parsed = UpdateGroupSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ValidationError(
            "Invalid group update payload",
            parsed.error.issues.map((issue) => ({
              path: issue.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
              code: issue.code,
              message: issue.message,
            }))
          )
        );
      }
      const group = await groupService.updateGroup(actorUserId, groupId, parsed.data);
      res.status(200).json({ data: group });
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/groups/:groupId/members - Add member by email
  router.post("/v1/groups/:groupId/members", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const groupId = String(req.params.groupId);
      const parsed = AddGroupMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(
          new ValidationError(
            "Invalid member payload",
            parsed.error.issues.map((issue) => ({
              path: issue.path.filter((p): p is string | number => typeof p === "string" || typeof p === "number"),
              code: issue.code,
              message: issue.message,
            }))
          )
        );
      }
      const group = await groupService.addGroupMember(actorUserId, groupId, parsed.data);
      res.status(200).json({ data: group });
    } catch (error) {
      next(error);
    }
  });

  // DELETE /v1/groups/:groupId/members/:userId - Remove member or leave group
  router.delete("/v1/groups/:groupId/members/:userId", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const groupId = String(req.params.groupId);
      const userId = String(req.params.userId);
      await groupService.removeGroupMember(actorUserId, groupId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // POST /v1/groups/:groupId/leave - Leave group endpoint
  router.post("/v1/groups/:groupId/leave", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveInternalUserId(req);
      const groupId = String(req.params.groupId);
      await groupService.removeGroupMember(actorUserId, groupId, actorUserId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const groupRouter = createGroupRouter();

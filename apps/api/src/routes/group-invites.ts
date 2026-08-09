import { Router, type NextFunction, type Request, type Response } from "express";
import { GroupInviteTokenSchema } from "@spenza/contracts";
import { z } from "zod";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors/app-error.js";
import { groupInviteService as defaultGroupInviteService } from "../group-invites/group-invite-composition.js";
import type { GroupInviteService } from "../group-invites/group-invite-service.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";

const EmptyBodySchema = z.object({}).strict();
export type GroupInviteRouteService = Pick<
  GroupInviteService,
  "createInvite" | "revokeInvite" | "previewInvite" | "acceptInvite"
>;

async function defaultActorResolver(request: Request): Promise<string> {
  if (!request.actor?.clerkSubject) throw new UnauthorizedError();
  const trusted = await getTrustedClerkIdentity(request.actor.clerkSubject);
  const resolved = await identityService.resolve(trusted);
  if (resolved.kind === "legacy-reconciliation-required") {
    throw new ConflictError("Legacy identity reconciliation required", "LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
  }
  return resolved.user.id;
}

function tokenFrom(request: Request): string {
  const parsed = GroupInviteTokenSchema.safeParse(request.params.token);
  if (!parsed.success) throw new ValidationError("Invalid invite token");
  return parsed.data;
}

export function createGroupInviteRouter(
  service: GroupInviteRouteService = defaultGroupInviteService,
  resolveActor = defaultActorResolver,
): Router {
  const router = Router();

  router.post("/v1/groups/:groupId/invites", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const actorUserId = await resolveActor(request);
      const parsedBody = EmptyBodySchema.safeParse(request.body ?? {});
      if (!parsedBody.success) throw new ValidationError("Invite creation does not accept options");
      const invite = await service.createInvite(actorUserId, String(request.params.groupId));
      response.setHeader("Cache-Control", "private, no-store");
      response.status(201).json({ data: invite });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/v1/groups/:groupId/invites/current", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const actorUserId = await resolveActor(request);
      await service.revokeInvite(actorUserId, String(request.params.groupId));
      response.setHeader("Cache-Control", "private, no-store");
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/v1/group-invites/:token", async (request, response, next) => {
    try {
      const preview = await service.previewInvite(tokenFrom(request));
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({ data: preview });
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/group-invites/:token/accept", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const actorUserId = await resolveActor(request);
      const parsedBody = EmptyBodySchema.safeParse(request.body ?? {});
      if (!parsedBody.success) throw new ValidationError("Invite acceptance does not accept options");
      const result = await service.acceptInvite(actorUserId, tokenFrom(request));
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const groupInviteRouter = createGroupInviteRouter();

import express, { Router, Request, Response, NextFunction } from "express";
import { ActivityListQuerySchema } from "@spenza/contracts";
import { ConflictError, UnauthorizedError } from "../errors/app-error.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { activityService as defaultActivityService } from "../activity/activity-composition.js";
import type { ActivityService } from "../activity/activity-service.js";

type ActorResolver = (request: Request) => Promise<string>;

async function defaultActorResolver(request: Request): Promise<string> {
  if (!request.actor?.clerkSubject) throw new UnauthorizedError();
  const trusted = await getTrustedClerkIdentity(request.actor.clerkSubject);
  const resolved = await identityService.resolve(trusted);
  if (resolved.kind === "legacy-reconciliation-required") {
    throw new ConflictError("Legacy identity reconciliation required", "LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
  }
  return resolved.user.id;
}

export function createActivityRouter(
  service?: ActivityService,
  resolveActor: ActorResolver = defaultActorResolver
): Router {
  const router = express.Router();
  const getService = (): ActivityService => service ?? defaultActivityService;

  router.get("/v1/activity", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const query = ActivityListQuerySchema.parse(req.query);
      const data = await getService().listActivities(actorUserId, query);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const activityRouter = createActivityRouter();

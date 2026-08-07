import express, { Router, Request, Response, NextFunction } from "express";
import { PushSubscriptionSchema, NotificationPageSchema } from "@spenza/contracts";
import { ConflictError, UnauthorizedError } from "../errors/app-error.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { notificationService as defaultNotificationService } from "../notifications/notification-composition.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";

async function defaultActorResolver(request: Request): Promise<string> {
  if (!request.actor?.clerkSubject) throw new UnauthorizedError();
  const trusted = await getTrustedClerkIdentity(request.actor.clerkSubject);
  const resolved = await identityService.resolve(trusted);
  if (resolved.kind === "legacy-reconciliation-required") {
    throw new ConflictError("Legacy identity reconciliation required", "LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
  }
  return resolved.user.id;
}

export function createNotificationRouter(service = defaultNotificationService, resolveActor = defaultActorResolver): Router {
  const router = express.Router();

  router.post("/v1/push-subscriptions", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const input = PushSubscriptionSchema.parse(req.body);
      await service.subscribe(actorUserId, input);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(201).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/v1/push-subscriptions/:subscriptionId", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const endpoint = req.query.endpoint as string;
      if (req.params.subscriptionId === "by-endpoint" && endpoint) {
         // Custom logic if we don't have the ID but have the endpoint
         // We'll mock this for now or skip. Let's just pass to service.
         await service.unsubscribeByEndpoint(actorUserId, endpoint);
      } else {
         await service.unsubscribe(actorUserId, req.params.subscriptionId as string);
      }
      res.setHeader("Cache-Control", "private, no-store");
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  router.get("/v1/notifications", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      const data = await service.listNotifications(actorUserId, cursor, limit);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ data }); 
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/notifications/mark-read", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const { notificationId } = req.body;
      await service.markAsRead(actorUserId, notificationId);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(200).json({ data: { success: true } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const notificationRouter = createNotificationRouter();

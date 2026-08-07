import express, { Router, Request, Response, NextFunction } from "express";
import { CreateUploadRequestSchema, FinalizeUploadSchema } from "@spenza/contracts";
import { ConflictError, UnauthorizedError } from "../errors/app-error.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { receiptService as defaultReceiptService } from "../receipts/receipt-composition.js";
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

export function createReceiptRouter(service = defaultReceiptService, resolveActor = defaultActorResolver): Router {
  const router = express.Router();

  router.post("/v1/groups/:groupId/receipts/upload-requests", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const input = CreateUploadRequestSchema.parse(req.body);
      const result = await service.createUploadRequest(actorUserId, req.params.groupId as string, input);
      res.setHeader("Cache-Control", "private, no-store");
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.post("/v1/groups/:groupId/receipts/:receiptId/finalize", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const result = await service.finalizeUpload(actorUserId, req.params.groupId as string, req.params.receiptId as string);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  router.get("/v1/groups/:groupId/receipts/:receiptId/url", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const url = await service.getReceiptUrl(actorUserId, req.params.groupId as string, req.params.receiptId as string);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ data: { url } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const receiptRouter = createReceiptRouter();

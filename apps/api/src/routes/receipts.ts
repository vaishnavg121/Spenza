import express, { Router, Request, Response, NextFunction } from "express";
import { CreateUploadRequestSchema } from "@spenza/contracts";
import { ConflictError, NotFoundError, UnauthorizedError, ValidationError } from "../errors/app-error.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import {
  receiptService as defaultReceiptService,
  receiptStorageAdapter as defaultStorageAdapter,
} from "../receipts/receipt-composition.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { isMockStorageAdapter, type StorageAdapter } from "../receipts/storage-adapter.js";

async function defaultActorResolver(request: Request): Promise<string> {
  if (!request.actor?.clerkSubject) throw new UnauthorizedError();
  const trusted = await getTrustedClerkIdentity(request.actor.clerkSubject);
  const resolved = await identityService.resolve(trusted);
  if (resolved.kind === "legacy-reconciliation-required") {
    throw new ConflictError("Legacy identity reconciliation required", "LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
  }
  return resolved.user.id;
}

export function createReceiptRouter(
  service = defaultReceiptService,
  resolveActor = defaultActorResolver,
  storageAdapter: StorageAdapter = defaultStorageAdapter,
): Router {
  const router = express.Router();

  if (isMockStorageAdapter(storageAdapter)) {
    router.put(
      "/v1/local-receipt-uploads/:token",
      express.raw({ type: "*/*", limit: "10mb" }),
      (req: Request, res: Response, next: NextFunction) => {
        try {
          const contentType = req.get("Content-Type")?.split(";", 1)[0] ?? "";
          if (!Buffer.isBuffer(req.body)) {
            throw new ValidationError("Receipt upload body is required");
          }
          const result = storageAdapter.acceptUpload(String(req.params.token), contentType, req.body);
          if (!result.ok) {
            if (result.reason === "CONTENT_TYPE") throw new ValidationError("Receipt content type does not match the upload request");
            if (result.reason === "SIZE") throw new ValidationError("Receipt size does not match the upload request");
            throw new NotFoundError("Upload URL is invalid or expired", "UPLOAD_URL_INVALID");
          }
          res.setHeader("Cache-Control", "private, no-store");
          res.status(204).send();
        } catch (error) {
          next(error);
        }
      },
    );

    router.get("/v1/local-receipt-downloads/:token", (req: Request, res: Response, next: NextFunction) => {
      try {
        const object = storageAdapter.readDownload(String(req.params.token));
        if (!object) throw new NotFoundError("Receipt URL is invalid or expired", "RECEIPT_URL_INVALID");
        res.setHeader("Cache-Control", "private, no-store");
        res.type(object.contentType).send(object.bytes);
      } catch (error) {
        next(error);
      }
    });
  }

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

  router.get("/v1/groups/:groupId/expenses/:expenseId/receipts", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const result = await service.listExpenseReceipts(
        actorUserId,
        String(req.params.groupId),
        String(req.params.expenseId),
      );
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

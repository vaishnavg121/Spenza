import { Router, type NextFunction, type Request, type Response } from "express";
import {
  CreateSettlementSchema,
  ReverseSettlementSchema,
  SettlementIdempotencyKeySchema,
  SettlementListQuerySchema,
} from "@spenza/contracts";
import { z, type ZodError } from "zod";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors/app-error.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { settlementService as defaultSettlementService } from "../settlements/settlement-composition.js";
import type { SettlementService } from "../settlements/settlement-service.js";

const PathSchema = z.object({
  groupId: z.string().min(1).max(200),
  settlementId: z.string().min(1).max(200).optional(),
}).strict();

type ActorResolver = (request: Request) => Promise<string>;
export type SettlementRouteService = Pick<
  SettlementService,
  "getBalances" | "createSettlement" | "listSettlements" | "getSettlement" | "reverseSettlement"
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

function validationError(message: string, error: ZodError): ValidationError {
  return new ValidationError(message, error.issues.map((issue) => ({
    path: issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"),
    code: issue.code,
    message: issue.message,
  })));
}

export function createSettlementRouter(
  service: SettlementRouteService = defaultSettlementService,
  resolveActor: ActorResolver = defaultActorResolver,
): Router {
  const router = Router();

  router.get("/v1/groups/:groupId/balances", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const path = PathSchema.safeParse(request.params);
      if (!path.success) return next(validationError("Invalid balance path", path.error));
      const actorUserId = await resolveActor(request);
      const balances = await service.getBalances(actorUserId, path.data.groupId);
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({ data: balances });
    } catch (error) { next(error); }
  });

  router.post("/v1/groups/:groupId/settlements", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const path = PathSchema.safeParse(request.params);
      if (!path.success) return next(validationError("Invalid settlement path", path.error));
      const key = SettlementIdempotencyKeySchema.safeParse(request.get("Idempotency-Key"));
      if (!key.success) return next(validationError("A valid Idempotency-Key header is required", key.error));
      const body = CreateSettlementSchema.safeParse(request.body);
      if (!body.success) return next(validationError("Invalid settlement payload", body.error));
      const actorUserId = await resolveActor(request);
      const result = await service.createSettlement(
        actorUserId,
        path.data.groupId,
        key.data,
        body.data,
        String(request.id ?? "unknown"),
      );
      response.setHeader("Cache-Control", "private, no-store");
      response.setHeader("Location", `/v1/groups/${path.data.groupId}/settlements/${result.settlement.id}`);
      if (result.replayed) response.setHeader("X-Idempotent-Replay", "true");
      response.status(201).json({ data: result.settlement });
    } catch (error) { next(error); }
  });

  router.get("/v1/groups/:groupId/settlements", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const path = PathSchema.safeParse(request.params);
      if (!path.success) return next(validationError("Invalid settlement path", path.error));
      const query = SettlementListQuerySchema.safeParse(request.query);
      if (!query.success) return next(validationError("Invalid settlement list query", query.error));
      const actorUserId = await resolveActor(request);
      const page = await service.listSettlements(actorUserId, path.data.groupId, query.data);
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json(page);
    } catch (error) { next(error); }
  });

  router.get("/v1/groups/:groupId/settlements/:settlementId", requireAuthenticatedActor, async (request, response, next) => {
    try {
      const path = PathSchema.safeParse(request.params);
      if (!path.success) return next(validationError("Invalid settlement path", path.error));
      if (!path.data.settlementId) return next(new ValidationError("Settlement ID is required"));
      const actorUserId = await resolveActor(request);
      const settlement = await service.getSettlement(actorUserId, path.data.groupId, path.data.settlementId);
      response.setHeader("Cache-Control", "private, no-store");
      response.status(200).json({ data: settlement });
    } catch (error) { next(error); }
  });

  router.post(
    "/v1/groups/:groupId/settlements/:settlementId/reverse",
    requireAuthenticatedActor,
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const path = PathSchema.safeParse(request.params);
        if (!path.success) return next(validationError("Invalid settlement path", path.error));
        if (!path.data.settlementId) return next(new ValidationError("Settlement ID is required"));
        const key = SettlementIdempotencyKeySchema.safeParse(request.get("Idempotency-Key"));
        if (!key.success) return next(validationError("A valid Idempotency-Key header is required", key.error));
        const body = ReverseSettlementSchema.safeParse(request.body ?? {});
        if (!body.success) return next(validationError("Invalid settlement reversal payload", body.error));
        const actorUserId = await resolveActor(request);
        const result = await service.reverseSettlement(
          actorUserId,
          path.data.groupId,
          path.data.settlementId,
          key.data,
          String(request.id ?? "unknown"),
        );
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Location", `/v1/groups/${path.data.groupId}/settlements/${result.settlement.id}`);
        if (result.replayed) response.setHeader("X-Idempotent-Replay", "true");
        response.status(201).json({ data: result.settlement });
      } catch (error) { next(error); }
    },
  );

  return router;
}

export const settlementRouter = createSettlementRouter();

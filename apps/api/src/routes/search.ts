import express, { Router, Request, Response, NextFunction } from "express";
import { ExpenseSearchQuerySchema } from "@spenza/contracts";
import { ConflictError, UnauthorizedError } from "../errors/app-error.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { searchService as defaultSearchService } from "../search/search-composition.js";
import type { SearchService } from "../search/search-service.js";

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

export function createSearchRouter(
  service?: SearchService,
  resolveActor: ActorResolver = defaultActorResolver
): Router {
  const router = express.Router();
  const getService = (): SearchService => service ?? defaultSearchService;

  router.get("/v1/search/expenses", requireAuthenticatedActor, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actorUserId = await resolveActor(req);
      const query = ExpenseSearchQuerySchema.parse(req.query);
      const data = await getService().searchExpenses(actorUserId, query);
      res.setHeader("Cache-Control", "private, no-store");
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const searchRouter = createSearchRouter();

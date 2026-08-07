import { Router } from "express";
import { UpdateProfileSchema } from "@spenza/contracts";
import { ConflictError, ValidationError } from "../errors/app-error.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";
import { IdentityConflictError, IdentityService } from "../identity/identity-service.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityRepository, identityService as defaultIdentityService } from "../identity/identity-composition.js";

const reconciliationError = () => new ConflictError("Legacy identity reconciliation is required.", "LEGACY_IDENTITY_RECONCILIATION_REQUIRED");
export function createProfileRouter(identityService: IdentityService = defaultIdentityService) {
const profileRouter = Router();
profileRouter.get("/v1/me", requireAuthenticatedActor, async (req, res, next) => {
  try { const result = await identityService.resolve(await getTrustedClerkIdentity(req.actor!.clerkSubject)); if (result.kind !== "resolved") return next(reconciliationError()); return res.json({ data: result.user }); } catch (error) { return next(error instanceof IdentityConflictError ? new ConflictError("Identity conflict.", "IDENTITY_CONFLICT") : error); }
});
profileRouter.patch("/v1/me", requireAuthenticatedActor, async (req, res, next) => {
  const result = UpdateProfileSchema.safeParse(req.body);
  if (!result.success) return next(new ValidationError("The request payload is invalid.", result.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"), code: issue.code, message: issue.message }))));
  try { const identity = await identityService.resolve(await getTrustedClerkIdentity(req.actor!.clerkSubject)); if (identity.kind !== "resolved") return next(reconciliationError()); const updated = await identityRepository.updateProfile(identity.user.id, result.data); return res.json({ data: updated }); } catch (error) { return next(error instanceof IdentityConflictError ? new ConflictError("Identity conflict.", "IDENTITY_CONFLICT") : error); }
});
return profileRouter;
}
export const profileRouter = createProfileRouter();

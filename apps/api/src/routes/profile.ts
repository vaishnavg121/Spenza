import { Router } from "express";
import { UpdateProfileSchema } from "@spenza/contracts";
import { ConflictError, ValidationError } from "../errors/app-error.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";

const identityMigrationError = () => new ConflictError("Your Clerk identity has not been linked to a Spenza profile yet.", "IDENTITY_LINK_REQUIRED");
export const profileRouter = Router();
profileRouter.get("/v1/me", requireAuthenticatedActor, (_req, _res, next) => next(identityMigrationError()));
profileRouter.patch("/v1/me", requireAuthenticatedActor, (req, _res, next) => {
  const result = UpdateProfileSchema.safeParse(req.body);
  if (!result.success) return next(new ValidationError("The request payload is invalid.", result.error.issues.map((issue) => ({ path: issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"), code: issue.code, message: issue.message }))));
  next(identityMigrationError());
});

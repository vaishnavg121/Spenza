import type { NextFunction, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import { UnauthorizedError } from "../errors/app-error.js";

export type AuthenticatedActor = { clerkSubject: string };
declare global { namespace Express { interface Request { actor?: AuthenticatedActor; } } }
export function requireAuthenticatedActor(req: Request, _res: Response, next: NextFunction) {
  const auth = getAuth(req);
  if (!auth.isAuthenticated || !auth.userId) return next(new UnauthorizedError());
  req.actor = { clerkSubject: auth.userId };
  next();
}

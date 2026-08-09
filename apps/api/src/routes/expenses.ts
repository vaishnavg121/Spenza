import { Router, type NextFunction, type Request, type Response } from "express";
import {
  CreateExpenseSchema,
  ExpenseListQuerySchema,
  IdempotencyKeySchema,
  UpdateExpenseSchema,
  VoidExpenseSchema,
} from "@spenza/contracts";
import { z, type ZodError } from "zod";
import { expenseService as defaultExpenseService } from "../expenses/expense-composition.js";
import type { ExpenseService } from "../expenses/expense-service.js";
import { ConflictError, UnauthorizedError, ValidationError } from "../errors/app-error.js";
import { getTrustedClerkIdentity } from "../identity/clerk-identity.js";
import { identityService } from "../identity/identity-composition.js";
import { requireAuthenticatedActor } from "../middleware/auth.js";

const ExpensePathSchema = z.object({
  groupId: z.string().min(1).max(200),
  expenseId: z.string().min(1).max(200).optional(),
}).strict();

type ActorResolver = (request: Request) => Promise<string>;
export type ExpenseRouteService = Pick<
  ExpenseService,
  "createExpense" | "listExpenses" | "getExpense" | "updateExpense" | "voidExpense"
>;

async function defaultActorResolver(request: Request): Promise<string> {
  if (!request.actor?.clerkSubject) throw new UnauthorizedError();
  const trustedIdentity = await getTrustedClerkIdentity(request.actor.clerkSubject);
  const resolved = await identityService.resolve(trustedIdentity);
  if (resolved.kind === "legacy-reconciliation-required") {
    throw new ConflictError(
      "Legacy identity reconciliation required",
      "LEGACY_IDENTITY_RECONCILIATION_REQUIRED",
    );
  }
  return resolved.user.id;
}

function validationError(message: string, error: ZodError): ValidationError {
  return new ValidationError(
    message,
    error.issues.map((issue) => ({
      path: issue.path.filter((part): part is string | number => typeof part === "string" || typeof part === "number"),
      code: issue.code,
      message: issue.message,
    })),
  );
}

export function createExpenseRouter(
  service: ExpenseRouteService = defaultExpenseService,
  resolveActor: ActorResolver = defaultActorResolver,
): Router {
  const router = Router();

  router.post(
    "/v1/groups/:groupId/expenses",
    requireAuthenticatedActor,
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const path = ExpensePathSchema.safeParse(request.params);
        if (!path.success) return next(validationError("Invalid expense path", path.error));
        const key = IdempotencyKeySchema.safeParse(request.get("Idempotency-Key"));
        if (!key.success) return next(validationError("A valid Idempotency-Key header is required", key.error));
        const body = CreateExpenseSchema.safeParse(request.body);
        if (!body.success) return next(validationError("Invalid expense payload", body.error));

        const actorUserId = await resolveActor(request);
        const result = await service.createExpense(
          actorUserId,
          path.data.groupId,
          key.data,
          body.data,
          String(request.id ?? "unknown"),
        );
        response.setHeader("Cache-Control", "private, no-store");
        response.setHeader("Location", `/v1/groups/${path.data.groupId}/expenses/${result.expense.id}`);
        if (result.replayed) response.setHeader("X-Idempotent-Replay", "true");
        response.status(201).json({ data: result.expense });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/v1/groups/:groupId/expenses",
    requireAuthenticatedActor,
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const path = ExpensePathSchema.safeParse(request.params);
        if (!path.success) return next(validationError("Invalid expense path", path.error));
        const query = ExpenseListQuerySchema.safeParse(request.query);
        if (!query.success) return next(validationError("Invalid expense list query", query.error));
        const actorUserId = await resolveActor(request);
        const page = await service.listExpenses(actorUserId, path.data.groupId, query.data);
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json(page);
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/v1/groups/:groupId/expenses/:expenseId",
    requireAuthenticatedActor,
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const path = ExpensePathSchema.safeParse(request.params);
        if (!path.success) return next(validationError("Invalid expense path", path.error));
        if (!path.data.expenseId) return next(new ValidationError("Expense ID is required"));
        const actorUserId = await resolveActor(request);
        const expense = await service.getExpense(actorUserId, path.data.groupId, path.data.expenseId);
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ data: expense });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch(
    "/v1/groups/:groupId/expenses/:expenseId",
    requireAuthenticatedActor,
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const path = ExpensePathSchema.safeParse(request.params);
        if (!path.success) return next(validationError("Invalid expense path", path.error));
        if (!path.data.expenseId) return next(new ValidationError("Expense ID is required"));
        const body = UpdateExpenseSchema.safeParse(request.body);
        if (!body.success) return next(validationError("Invalid expense update payload", body.error));
        const actorUserId = await resolveActor(request);
        const expense = await service.updateExpense(
          actorUserId,
          path.data.groupId,
          path.data.expenseId,
          body.data,
          String(request.id ?? "unknown"),
        );
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ data: expense });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/v1/groups/:groupId/expenses/:expenseId/void",
    requireAuthenticatedActor,
    async (request: Request, response: Response, next: NextFunction) => {
      try {
        const path = ExpensePathSchema.safeParse(request.params);
        if (!path.success) return next(validationError("Invalid expense path", path.error));
        if (!path.data.expenseId) return next(new ValidationError("Expense ID is required"));
        const body = VoidExpenseSchema.safeParse(request.body);
        if (!body.success) return next(validationError("Invalid expense void payload", body.error));
        const actorUserId = await resolveActor(request);
        const expense = await service.voidExpense(
          actorUserId,
          path.data.groupId,
          path.data.expenseId,
          body.data,
          String(request.id ?? "unknown"),
        );
        response.setHeader("Cache-Control", "private, no-store");
        response.status(200).json({ data: expense });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export const expenseRouter = createExpenseRouter();

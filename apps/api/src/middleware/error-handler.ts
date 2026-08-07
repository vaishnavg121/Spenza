import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { ApiErrorEnvelope, ApiErrorDetail } from "@spenza/contracts";
import { AppError } from "../errors/app-error.js";
import { logger } from "../lib/logger.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const requestId = (req.id as string) || "unknown";

  res.setHeader("Cache-Control", "private, no-store");

  if (err instanceof ZodError) {
    const details: ApiErrorDetail[] = err.issues.map((issue) => ({
      path: issue.path as (string | number)[],
      code: issue.code,
      message: issue.message,
    }));

    const envelope: ApiErrorEnvelope = {
      error: {
        code: "VALIDATION_FAILED",
        message: "The request payload or parameters are invalid.",
        details,
        requestId,
      },
    };
    return res.status(400).json(envelope);
  }

  if (err instanceof AppError) {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    };
    return res.status(err.statusCode).json(envelope);
  }

  if ("type" in err && err.type === "entity.too.large") {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload size exceeds maximum limit.",
        requestId,
      },
    };
    return res.status(413).json(envelope);
  }

  if (err instanceof SyntaxError && "status" in err && (err as { status?: number }).status === 400) {
    const envelope: ApiErrorEnvelope = {
      error: {
        code: "MALFORMED_JSON",
        message: "Malformed JSON payload provided.",
        requestId,
      },
    };
    return res.status(400).json(envelope);
  }

  logger.error({ err, requestId, path: req.path }, "Unhandled application error");

  const internalEnvelope: ApiErrorEnvelope = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An internal server error occurred.",
      requestId,
    },
  };
  return res.status(500).json(internalEnvelope);
}

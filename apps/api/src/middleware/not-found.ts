import { Request, Response } from "express";
import { ApiErrorEnvelope } from "@spenza/contracts";

export function notFoundHandler(req: Request, res: Response) {
  const errorEnvelope: ApiErrorEnvelope = {
    error: {
      code: "NOT_FOUND",
      message: `Route not found: ${req.method} ${req.path}`,
      requestId: (req.id as string) || "unknown",
    },
  };
  res.status(404).json(errorEnvelope);
}

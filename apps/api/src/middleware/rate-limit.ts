import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { ApiErrorEnvelope } from "@spenza/contracts";

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const errorEnvelope: ApiErrorEnvelope = {
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
        requestId: (req.id as string) || "unknown",
      },
    };
    res.status(429).json(errorEnvelope);
  },
});

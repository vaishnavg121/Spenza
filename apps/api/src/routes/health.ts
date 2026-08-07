import { Router } from "express";
import { HealthResponse } from "@spenza/contracts";
import { env } from "../config/env.js";

export const healthRouter = Router();

// Operational unversioned Liveness/Readiness probe: GET /health
healthRouter.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Versioned API Health: GET /v1/health
healthRouter.get("/v1/health", (_req, res) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    environment: env.NODE_ENV,
    uptime: process.uptime(),
  };
  res.status(200).json({ data: response });
});

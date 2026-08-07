import cors from "cors";
import { env } from "../config/env.js";

export function createCorsMiddleware() {
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());

  return cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server or tests)
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        callback(new Error("CORS policy error: Origin not allowed"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Idempotency-Key"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true,
    maxAge: 86400,
  });
}

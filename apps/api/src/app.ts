import "./config/env.js";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { logger } from "./lib/logger.js";
import { requestIdMiddleware } from "./middleware/request-id.js";
import { createCorsMiddleware } from "./middleware/cors.js";
import { apiRateLimiter } from "./middleware/rate-limit.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { errorHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { clerkMiddleware } from "@clerk/express";
import { profileRouter } from "./routes/profile.js";
import { groupRouter } from "./routes/groups.js";
import { expenseRouter } from "./routes/expenses.js";
import { settlementRouter } from "./routes/settlements.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { activityRouter } from "./routes/activity.js";
import { searchRouter } from "./routes/search.js";
import { analyticsRouter } from "./routes/analytics.js";
import { receiptRouter } from "./routes/receipts.js";
import { notificationRouter } from "./routes/notifications.js";
import { groupInviteRouter } from "./routes/group-invites.js";

export function createApp(): express.Application {
  const app = express();

  // 1. Request ID propagation
  app.use(requestIdMiddleware);
  app.use(clerkMiddleware());

  // 2. Pino HTTP logger
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/v1/health",
      },
      genReqId: (req) => (req as express.Request).id || "unknown",
    })
  );

  // 3. Security headers
  app.use(helmet());

  // 4. CORS
  app.use(createCorsMiddleware());

  // 5. Body limits
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // 6. Rate Limiting
  app.use(apiRateLimiter);

  // 7. Routes
  app.use(healthRouter);
  app.use(profileRouter);
  app.use(groupRouter);
  app.use(groupInviteRouter);
  app.use(expenseRouter);
  app.use(settlementRouter);
  app.use(dashboardRouter);
  app.use(activityRouter);
  app.use(searchRouter);
  app.use(analyticsRouter);
  app.use(receiptRouter);
  app.use(notificationRouter);

  // 8. 404 Handler
  app.use(notFoundHandler);

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();

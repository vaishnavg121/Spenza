import { app } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, `Express API service listening on port ${env.PORT}`);
});

function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing HTTP server gracefully...");
  server.close(() => {
    logger.info("HTTP server closed. Exiting process.");
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("Forced process shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

import { z } from "zod";

export const HealthStatusSchema = z.enum(["ok", "degraded", "down"]);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const HealthResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string(),
  version: z.string(),
  environment: z.string(),
  uptime: z.number().optional(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

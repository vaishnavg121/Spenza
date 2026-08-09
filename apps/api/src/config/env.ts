import { z } from "zod";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

// Load .env.local first if it exists, then fallback to .env
const envLocalPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}
dotenv.config();

export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z.string().optional().default("postgresql://localhost:5432/spenza"),
    ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
    RECEIPTS_BUCKET_NAME: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    GROUP_INVITE_SECRET: z.string().min(32).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (!data.RECEIPTS_BUCKET_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "RECEIPTS_BUCKET_NAME is required in production",
          path: ["RECEIPTS_BUCKET_NAME"],
        });
      }
      if (!data.CLERK_SECRET_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CLERK_SECRET_KEY is required in production",
          path: ["CLERK_SECRET_KEY"],
        });
      }
      if (!data.GROUP_INVITE_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "GROUP_INVITE_SECRET is required in production",
          path: ["GROUP_INVITE_SECRET"],
        });
      }
    }
  });

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:", result.error.format());
    throw new Error("Invalid environment configuration");
  }
  return result.data;
}

export const env = parseEnv();
if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

import { PrismaClient } from "@prisma/client";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { PrismaGroupInviteRepository } from "./group-invite-repository.js";
import { GroupInviteService } from "./group-invite-service.js";
import { GroupInviteTokenCodec } from "./group-invite-token.js";

const prisma = new PrismaClient();
const fallbackSecret = "spenza-local-group-invite-secret-do-not-use-in-production";
const secret = env.GROUP_INVITE_SECRET ?? env.CLERK_SECRET_KEY ?? fallbackSecret;

if (!env.GROUP_INVITE_SECRET && env.NODE_ENV !== "test") {
  logger.warn("GROUP_INVITE_SECRET is not configured; using a development-only fallback");
}

export const groupInviteRepository = new PrismaGroupInviteRepository(prisma);
export const groupInviteService = new GroupInviteService(
  groupInviteRepository,
  new GroupInviteTokenCodec(secret),
);

import { PrismaClient } from "@prisma/client";
import { createPrismaIdentityRepository } from "./identity-repository.js";
import { IdentityService } from "./identity-service.js";

const prisma = new PrismaClient();
export const identityRepository = createPrismaIdentityRepository(prisma);
export const identityService = new IdentityService(identityRepository);

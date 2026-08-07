import { PrismaClient } from "@prisma/client";
import { PrismaSettlementRepository } from "./settlement-repository.js";
import { SettlementService } from "./settlement-service.js";

const prisma = new PrismaClient();
export const settlementRepository = new PrismaSettlementRepository(prisma);
export const settlementService = new SettlementService(settlementRepository);

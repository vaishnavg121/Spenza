import { PrismaClient } from "@prisma/client";
import { PrismaGroupRepository } from "./group-repository.js";
import { GroupService } from "./group-service.js";

const prisma = new PrismaClient();
export const groupRepository = new PrismaGroupRepository(prisma);
export const groupService = new GroupService(groupRepository);

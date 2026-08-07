import { PrismaClient } from "@prisma/client";
import { PrismaExpenseRepository } from "./expense-repository.js";
import { ExpenseService } from "./expense-service.js";

const prisma = new PrismaClient();
export const expenseRepository = new PrismaExpenseRepository(prisma);
export const expenseService = new ExpenseService(expenseRepository);

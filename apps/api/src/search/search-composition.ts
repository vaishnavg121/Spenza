import { PrismaClient } from "@prisma/client";
import { PrismaSearchRepository } from "./search-repository.js";
import { SearchService } from "./search-service.js";

const prisma = new PrismaClient();
export const searchService = new SearchService(new PrismaSearchRepository(prisma));

export function createSearchService(): SearchService {
  return searchService;
}

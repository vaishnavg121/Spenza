import {
  ExpenseSearchPageSchema,
  type ExpenseSearchPage,
  type ExpenseSearchQuery,
} from "@spenza/contracts";
import { ValidationError } from "../errors/app-error.js";
import { serializeExpense } from "../expenses/expense-service.js";
import { type SearchRepository } from "./search-repository.js";

function encodeCursor(id: string): string {
  return Buffer.from(id, "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  if (!decoded || encodeCursor(decoded) !== cursor) {
    throw new ValidationError("Invalid search cursor");
  }
  return decoded;
}

export class SearchService {
  constructor(private readonly repository: SearchRepository) {}

  async searchExpenses(actorUserId: string, query: ExpenseSearchQuery): Promise<ExpenseSearchPage> {
    const authorizedGroupIds = await this.repository.findUserGroupIds(actorUserId);
    const cursorId = decodeCursor(query.cursor);

    const records = await this.repository.searchExpenses(actorUserId, authorizedGroupIds, query, cursorId);
    const hasMore = records.length > query.limit;
    const items = hasMore ? records.slice(0, query.limit) : records;
    const nextCursor = hasMore && items.length > 0 ? encodeCursor(items[items.length - 1].id) : null;

    return ExpenseSearchPageSchema.parse({
      data: items.map(serializeExpense),
      page: {
        nextCursor,
        hasMore,
      },
    });
  }
}

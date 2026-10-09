import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import type { DbTransaction } from "./discovery-internal";
import { mapError, requireUser } from "./discovery-internal";

export const listRecentSearches = async (
  userId: string
): Promise<readonly string[]> => {
  const searches = await db.orm.public.RecentSearch.where({ userId })
    .orderBy((search) => search.searchedAt.desc())
    .limit(10)
    .select("query")
    .all();
  return searches.map(({ query }) => query);
};

export const saveRecentSearch = async (
  transaction: DbTransaction,
  userId: string,
  query: string
): Promise<void> => {
  if (!query) {
    return;
  }
  const existing = await transaction.orm.public.RecentSearch.where({ userId })
    .select("id", "query")
    .all();
  const duplicateIds: string[] = [];
  for (const search of existing) {
    if (search.query.toLowerCase() === query.toLowerCase()) {
      duplicateIds.push(search.id);
    }
  }
  if (duplicateIds.length > 0) {
    await transaction.orm.public.RecentSearch.where((search) =>
      search.id.in(duplicateIds)
    ).deleteAll();
  }
  await transaction.orm.public.RecentSearch.create({
    id: randomUUID(),
    query,
    searchedAt: new Date(),
    userId,
  });
  const ordered = await transaction.orm.public.RecentSearch.where({ userId })
    .orderBy((search) => search.searchedAt.desc())
    .select("id")
    .all();
  const expiredIds = ordered.slice(10).map(({ id }) => id);
  if (expiredIds.length > 0) {
    await transaction.orm.public.RecentSearch.where((search) =>
      search.id.in(expiredIds)
    ).deleteAll();
  }
};

export const addRecentSearch = (
  userId: string,
  input: string
): Effect.Effect<readonly string[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const query = input.trim().slice(0, 120);
      await requireUser(userId);
      await db.transaction((transaction) =>
        saveRecentSearch(transaction, userId, query)
      );
      return listRecentSearches(userId);
    },
  });

import { Effect } from "effect";

import { PAGE_DEFAULT_SIZE } from "../../mobile-api/routes-paging";
import { AppError } from "../core/action-result";

export interface Page<Item> {
  readonly items: readonly Item[];
  readonly nextCursor: string | null;
}

const invalidCursor = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    field: "cursor",
    message: "That page cursor is not valid.",
  });

const encodeCursor = (id: string): string =>
  Buffer.from(id, "utf-8").toString("base64url");

const decodeCursor = (cursor: string): string =>
  Buffer.from(cursor, "base64url").toString("utf-8");

// One page of a list that is already ordered and filtered for this caller. The
// cursor names the last row the caller saw, so a page never repeats or skips a
// row while the list stays the same. A cursor whose row is gone from the list
// is refused and the app starts again from the top.
export const pageOf = <Item>(
  items: readonly Item[],
  idOf: (item: Item) => string,
  query: {
    readonly cursor?: string | undefined;
    readonly limit?: number | undefined;
  }
): Effect.Effect<Page<Item>, AppError> =>
  Effect.suspend(() => {
    let start = 0;
    if (query.cursor) {
      const after = decodeCursor(query.cursor);
      const position = items.findIndex((item) => idOf(item) === after);
      if (position === -1) {
        return Effect.fail(invalidCursor());
      }
      start = position + 1;
    }
    const limit = query.limit ?? PAGE_DEFAULT_SIZE;
    const slice = items.slice(start, start + limit);
    const last = slice.at(-1);
    return Effect.succeed({
      items: slice,
      nextCursor:
        last && start + limit < items.length ? encodeCursor(idOf(last)) : null,
    });
  });

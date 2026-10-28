import { Schema } from "effect";

export const PAGE_DEFAULT_SIZE = 50;
export const PAGE_MAX_SIZE = 100;

// The query every paged list takes. `nextCursor` in a response is passed back
// as `cursor` to get the rows after it; `null` means the list has ended.
export const PageQuerySchema = Schema.Struct({
  cursor: Schema.optional(Schema.String.check(Schema.isMinLength(1))),
  limit: Schema.optional(
    Schema.FiniteFromString.check(
      Schema.isInt(),
      Schema.isBetween({ maximum: PAGE_MAX_SIZE, minimum: 1 })
    )
  ),
});

export const NextCursorSchema = Schema.NullOr(Schema.String);

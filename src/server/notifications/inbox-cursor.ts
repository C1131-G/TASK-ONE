import { AppError } from "../core/action-result";

export interface InboxCursor {
  readonly createdAt: Date;
  readonly id: string;
}

const CURSOR_SEPARATOR = "|";

// Notifications are ordered newest first with the id as a tie-breaker, so a
// cursor is the last row's position and a page never repeats or skips a row,
// even when many share one timestamp. The text is opaque to the app.
export const encodeInboxCursor = (cursor: InboxCursor): string =>
  Buffer.from(
    `${cursor.createdAt.toISOString()}${CURSOR_SEPARATOR}${cursor.id}`
  ).toString("base64url");

const invalidCursor = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    field: "cursor",
    message: "That page cursor is not valid.",
  });

export const decodeInboxCursor = (value: string): InboxCursor => {
  const [iso, id, ...rest] = Buffer.from(value, "base64url")
    .toString("utf-8")
    .split(CURSOR_SEPARATOR);
  const createdAt = new Date(iso ?? "");
  if (!id || rest.length > 0 || Number.isNaN(createdAt.getTime())) {
    throw invalidCursor();
  }
  return { createdAt, id };
};

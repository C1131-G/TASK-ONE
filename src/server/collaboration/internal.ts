import { Schema } from "effect";

import { AppError } from "../core/action-result";

export const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The collaboration request could not be completed.",
      });

export const uuidSchema = Schema.String.check(Schema.isUUID());
export const extractMentionIds = (body: string): readonly string[] => {
  const mentions = new Set<string>();
  let searchFrom = 0;
  while (searchFrom < body.length) {
    const tokenStart = body.indexOf("@[", searchFrom);
    if (tokenStart === -1) {
      break;
    }
    const tokenEnd = body.indexOf("]", tokenStart + 2);
    if (tokenEnd === -1) {
      break;
    }
    const candidate = body.slice(tokenStart + 2, tokenEnd);
    if (Schema.is(uuidSchema)(candidate)) {
      mentions.add(candidate);
    }
    searchFrom = tokenEnd + 1;
  }
  return [...mentions];
};

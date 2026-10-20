import "server-only";
import { notFound } from "next/navigation";

import type {
  ActionResult,
  AppErrorCode,
} from "@/src/server/core/action-result";

// A malformed id fails validation; to the visitor it is a missing record.
const MISSING_RECORD_CODES: ReadonlySet<AppErrorCode> = new Set([
  "NOT_FOUND",
  "VALIDATION_FAILED",
]);

// Portal reads never confirm that another company's record exists.
export const HIDDEN_RECORD_CODES: ReadonlySet<AppErrorCode> = new Set([
  ...MISSING_RECORD_CODES,
  "FORBIDDEN",
]);

// Unwraps a page read. A failure throws so the section's error boundary shows
// its retry instead of a static notice.
export const readOrThrow = <Data>(
  result: ActionResult<Data>,
  label: string
): Data => {
  if (!result.ok) {
    throw new Error(`${label} could not be loaded.`);
  }
  return result.data;
};

// Unwraps a read of one record: a missing record renders the segment's
// not-found page, any other failure reaches the error boundary.
export const readRecordOrNotFound = <Data>(
  result: ActionResult<Data>,
  label: string,
  missingCodes: ReadonlySet<AppErrorCode> = MISSING_RECORD_CODES
): Data => {
  if (!result.ok && missingCodes.has(result.error.code)) {
    notFound();
  }
  return readOrThrow(result, label);
};

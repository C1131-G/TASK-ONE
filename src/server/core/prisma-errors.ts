import { SqlQueryError } from "@prisma/orm-family-sql/errors";

export { isUniqueConstraintViolation } from "@prisma/orm-family-sql/errors";

// 23503 is a plain foreign key violation; 23001 is the RESTRICT form, which is
// what a delete reports when the constraint says ON DELETE RESTRICT.
const REFERENCE_VIOLATION_STATES: ReadonlySet<string> = new Set([
  "23001",
  "23503",
]);
const MAX_CAUSE_DEPTH = 3;

// True when a row cannot be deleted because another row still points to it.
// The driver error may sit a few levels down a wrapped error.
export const isForeignKeyViolation = (error: unknown, depth = 0): boolean => {
  if (
    SqlQueryError.is(error) &&
    error.sqlState !== undefined &&
    REFERENCE_VIOLATION_STATES.has(error.sqlState)
  ) {
    return true;
  }
  return (
    error instanceof Error &&
    error.cause !== undefined &&
    depth < MAX_CAUSE_DEPTH &&
    isForeignKeyViolation(error.cause, depth + 1)
  );
};

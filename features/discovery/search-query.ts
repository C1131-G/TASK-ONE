const MAX_QUERY_LENGTH = 120;

// ?q may be missing, repeated, or oversized; only a single string is searched.
const parseSearchQuery = (value: unknown): string =>
  typeof value === "string" ? value.slice(0, MAX_QUERY_LENGTH) : "";

export { parseSearchQuery };

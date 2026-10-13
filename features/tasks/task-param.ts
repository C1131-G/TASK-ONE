// ?task=<id> opens that task's drawer on load; anything else opens nothing.
const parseTaskIdParam = (value: unknown): string | null =>
  typeof value === "string" && value ? value : null;

export { parseTaskIdParam };

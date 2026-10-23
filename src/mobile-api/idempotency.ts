// Sent with every write so a retry after a dropped connection is replayed
// instead of acting twice. The server reads the same name.
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";

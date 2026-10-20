import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  readonly requestId?: string;
  readonly error?: unknown;
  /** A pre-rendered cause, such as `Cause.pretty`, kept verbatim. */
  readonly cause?: string;
  readonly [field: string]: unknown;
}

interface SerializedError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: SerializedError | string;
}

// Error causes can chain indefinitely or loop; three levels is enough to
// reach the driver error behind a wrapped domain error.
const MAX_CAUSE_DEPTH = 3;

const serializeError = (
  error: unknown,
  depth = 0
): SerializedError | string => {
  if (!(error instanceof Error)) {
    return typeof error === "string" ? error : (JSON.stringify(error) ?? "");
  }
  const nested =
    error.cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? { cause: serializeError(error.cause, depth + 1) }
      : {};
  return {
    message: error.message,
    name: error.name,
    ...(error.stack ? { stack: error.stack } : {}),
    ...nested,
  };
};

// Values JSON cannot represent (bigint, cycles) must not make logging throw.
const toJsonLine = (entry: Record<string, unknown>): string => {
  try {
    return JSON.stringify(entry, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value
    );
  } catch {
    return JSON.stringify({
      level: entry["level"],
      message: entry["message"],
      time: entry["time"],
    });
  }
};

const write = (level: LogLevel, message: string, fields: LogFields = {}) => {
  const { error, ...rest } = fields;
  const line = toJsonLine({
    level,
    message,
    time: new Date().toISOString(),
    ...rest,
    ...(error === undefined ? {} : { error: serializeError(error) }),
  });
  const stream =
    level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(`${line}\n`);
};

/** Writes one JSON object per line so log collectors can parse entries. */
export const logger = {
  debug: (message: string, fields?: LogFields) =>
    write("debug", message, fields),
  error: (message: string, fields?: LogFields) =>
    write("error", message, fields),
  info: (message: string, fields?: LogFields) => write("info", message, fields),
  warn: (message: string, fields?: LogFields) => write("warn", message, fields),
} as const;

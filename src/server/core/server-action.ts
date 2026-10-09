import { Effect, Schema } from "effect";

import { AppError, runEffectResult } from "./action-result";

const isSerializableActionOutput = (
  value: unknown,
  ancestors = new WeakSet<object>()
): boolean => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "object") {
    return false;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime());
  }
  if (ancestors.has(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return false;
  }

  ancestors.add(value);
  const values = Array.isArray(value)
    ? value
    : Object.keys(value).map((key) => (value as Record<string, unknown>)[key]);
  const isSerializable = values.every((entry) =>
    isSerializableActionOutput(entry, ancestors)
  );
  ancestors.delete(value);
  return isSerializable && Object.getOwnPropertySymbols(value).length === 0;
};

const ServerActionOutputSchema = Schema.Unknown.check(
  Schema.makeFilter((value) =>
    isSerializableActionOutput(value)
      ? undefined
      : "The action result is not serializable."
  )
);

export const runServerAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
  ErrorType,
>(
  input: unknown,
  schema: InputSchema,
  execute: (validated: InputSchema["Type"]) => Effect.Effect<Result, ErrorType>,
  requestId?: string
) => {
  const program = Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      () =>
        new AppError({
          code: "VALIDATION_FAILED",
          message: "The request data is invalid.",
        })
    ),
    Effect.flatMap(execute),
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(ServerActionOutputSchema)(result).pipe(
        Effect.mapError(
          () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            })
        ),
        Effect.as(result)
      )
    )
  );

  return runEffectResult(program, requestId);
};

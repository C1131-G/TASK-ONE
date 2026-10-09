import { Effect, Schema } from "effect";

import { AppError, runEffectResult } from "./action-result";

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
    Effect.flatMap(execute)
  );

  return runEffectResult(program, requestId);
};

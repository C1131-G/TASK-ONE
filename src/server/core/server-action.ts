import { Effect, Schema } from "effect";

import { AppError, runEffectResult } from "./action-result";

const ServerActionOutputTreeSchema = Schema.Tree(
  Schema.Union([
    Schema.Null,
    Schema.Undefined,
    Schema.Finite,
    Schema.Boolean,
    Schema.String,
    Schema.Date,
  ])
);
const ServerActionOutputSchema = Schema.UndefinedOr(
  ServerActionOutputTreeSchema
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

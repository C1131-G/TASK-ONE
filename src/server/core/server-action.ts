import { Effect, Schema } from "effect";

import { AppError, runEffectResult } from "./action-result";
import type { ActionResult } from "./action-result";

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
export const ServerActionOutputSchema = Schema.UndefinedOr(
  ServerActionOutputTreeSchema
);

type ValidatedActionOutput<
  Result,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
> = OutputSchema extends typeof ServerActionOutputSchema
  ? Result
  : OutputSchema["Type"];

export const runServerAction = <
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
  ErrorType,
  OutputSchema extends Schema.Codec<unknown, unknown, never, never>,
>(
  input: unknown,
  schema: InputSchema,
  execute: (validated: InputSchema["Type"]) => Effect.Effect<Result, ErrorType>,
  requestId: string | undefined,
  outputSchema: OutputSchema
): Promise<ActionResult<ValidatedActionOutput<Result, OutputSchema>>> => {
  const program: Effect.Effect<unknown, unknown> = Schema.decodeUnknownEffect(
    schema
  )(input).pipe(
    Effect.mapError(
      () =>
        new AppError({
          code: "VALIDATION_FAILED",
          message: "The request data is invalid.",
        })
    ),
    Effect.flatMap(execute),
    Effect.flatMap((result): Effect.Effect<unknown, AppError> => {
      const validateOutput: Effect.Effect<unknown, unknown> =
        Schema.decodeUnknownEffect(Schema.toType(outputSchema))(result);
      return validateOutput.pipe(
        Effect.mapError(
          () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            })
        )
      );
    })
  );

  return runEffectResult(program, requestId) as Promise<
    ActionResult<ValidatedActionOutput<Result, OutputSchema>>
  >;
};

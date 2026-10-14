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

export function runServerAction<
  InputSchema extends Schema.Codec<unknown, unknown, never, never>,
  Result,
  ErrorType,
>(
  input: unknown,
  schema: InputSchema,
  execute: (validated: InputSchema["Type"]) => Effect.Effect<Result, ErrorType>,
  requestId: string | undefined,
  outputSchema: typeof ServerActionOutputSchema
): Promise<ActionResult<Result>>;

export function runServerAction<
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
): Promise<ActionResult<OutputSchema["Type"]>>;

export function runServerAction<
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
): Promise<unknown> {
  const program: Effect.Effect<
    { readonly result: Result; readonly validatedOutput: OutputSchema["Type"] },
    unknown
  > = Schema.decodeUnknownEffect(schema)(input).pipe(
    Effect.mapError(
      () =>
        new AppError({
          code: "VALIDATION_FAILED",
          message: "The request data is invalid.",
        })
    ),
    Effect.flatMap(execute),
    Effect.flatMap((result) =>
      Schema.decodeUnknownEffect(Schema.toType(outputSchema))(result).pipe(
        Effect.mapError(
          () =>
            new AppError({
              code: "UNAVAILABLE",
              message: "The request could not be completed.",
            })
        ),
        Effect.map((validatedOutput) => ({ result, validatedOutput }))
      )
    )
  );

  return runEffectResult(program, requestId).then((action) => {
    if (!action.ok) {
      return action;
    }
    const data = Object.is(outputSchema, ServerActionOutputSchema)
      ? action.data.result
      : action.data.validatedOutput;
    return { ...action, data };
  });
}

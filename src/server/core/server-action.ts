import { Effect, Schema, SchemaIssue } from "effect";

import { AppError, runEffectResult } from "./action-result";
import type { ActionResult, FieldErrors } from "./action-result";

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

const formatIssue = SchemaIssue.makeFormatterStandardSchemaV1();
const GENERIC_FIELD_MESSAGE = "Enter a valid value.";

// Built-in schema messages ("Expected string") describe types, not what the
// person should do; checks with their own message keep it.
const readableMessage = (message: string): string =>
  message.startsWith("Expected") || message.startsWith("Missing")
    ? GENERIC_FIELD_MESSAGE
    : message;

// The first failure for each top-level input key, keyed like the form field.
const fieldErrorsFromIssue = (issue: SchemaIssue.Issue): FieldErrors => {
  const fieldErrors: Record<string, string> = {};
  for (const { message, path } of formatIssue(issue).issues) {
    const [field] = path ?? [];
    if (typeof field === "string" && !(field in fieldErrors)) {
      fieldErrors[field] = readableMessage(message);
    }
  }
  return fieldErrors;
};

const invalidInput = (error: Schema.SchemaError): AppError => {
  const fieldErrors = fieldErrorsFromIssue(error.issue);
  return new AppError({
    code: "VALIDATION_FAILED",
    message: "The request data is invalid.",
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
  });
};

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
  > = Schema.decodeUnknownEffect(schema)(input, { errors: "all" }).pipe(
    Effect.mapError(invalidInput),
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

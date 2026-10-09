import { expect, it } from "bun:test";

import { Effect, Schema } from "effect";

import {
  ServerActionOutputSchema,
  runServerAction,
} from "../../src/server/core/server-action";

it("validates untrusted input before running a Server Action", async () => {
  let operationWasRun = false;
  const result = await runServerAction(
    { title: 123 },
    Schema.Struct({ title: Schema.String }),
    () => {
      operationWasRun = true;
      return Effect.succeed("created");
    },
    "req-invalid-action",
    ServerActionOutputSchema
  );

  expect(result).toEqual({
    error: {
      code: "VALIDATION_FAILED",
      message: "The request data is invalid.",
      requestId: "req-invalid-action",
    },
    ok: false,
  });
  expect(operationWasRun).toBe(false);
});

it("rejects Server Action results that cannot be serialized safely", async () => {
  const result = await runServerAction(
    {},
    Schema.Struct({}),
    () => Effect.succeed(() => "not serializable"),
    "req-invalid-output",
    ServerActionOutputSchema
  );

  expect(result).toEqual({
    error: {
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
      requestId: "req-invalid-output",
    },
    ok: false,
  });
});

it("preserves supported Date values in Server Action results", async () => {
  const timestamp = new Date("2026-10-09T00:00:00.000Z");
  const result = await runServerAction(
    {},
    Schema.Struct({}),
    () => Effect.succeed({ createdAt: timestamp }),
    "req-date-output",
    ServerActionOutputSchema
  );

  expect(result).toEqual({
    data: { createdAt: timestamp },
    ok: true,
    requestId: "req-date-output",
  });
});

it("rejects Server Action results that do not match their output schema", async () => {
  const result = await runServerAction(
    {},
    Schema.Struct({}),
    () => Effect.succeed({ id: 42 }),
    "req-invalid-output-shape",
    Schema.Struct({ id: Schema.String })
  );

  expect(result).toEqual({
    error: {
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
      requestId: "req-invalid-output-shape",
    },
    ok: false,
  });
});

it("returns only the validated output projection", async () => {
  const result = await runServerAction(
    {},
    Schema.Struct({}),
    () => Effect.succeed({ id: "visible", secret: () => "not serializable" }),
    "req-output-projection",
    Schema.Struct({ id: Schema.String })
  );

  expect(result).toEqual({
    data: { id: "visible" },
    ok: true,
    requestId: "req-output-projection",
  });
});

it("rejects values outside the serializable Server Action output contract", async () => {
  const result = await runServerAction(
    {},
    Schema.Struct({}),
    () => Effect.succeed({ invalid: () => "not serializable" }),
    "req-nonserializable-output",
    ServerActionOutputSchema
  );

  expect(result).toEqual({
    error: {
      code: "UNAVAILABLE",
      message: "The request could not be completed.",
      requestId: "req-nonserializable-output",
    },
    ok: false,
  });
});

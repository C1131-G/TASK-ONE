import { expect, it } from "bun:test";

import { Effect, Schema } from "effect";

import { runServerAction } from "../../src/server/core/server-action";

it("validates untrusted input before running a Server Action", async () => {
  let operationWasRun = false;
  const result = await runServerAction(
    { title: 123 },
    Schema.Struct({ title: Schema.String }),
    () => {
      operationWasRun = true;
      return Effect.succeed("created");
    },
    "req-invalid-action"
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
    "req-invalid-output"
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
    "req-date-output"
  );

  expect(result).toEqual({
    data: { createdAt: timestamp },
    ok: true,
    requestId: "req-date-output",
  });
});

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

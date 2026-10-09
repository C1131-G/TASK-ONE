import { describe, expect, it } from "bun:test";

import { Effect } from "effect";

import { AppError, runEffectResult } from "../../src/server/core/action-result";

describe("runEffectResult", () => {
  it("returns a safe typed failure with its request ID", async () => {
    const result = await runEffectResult(
      Effect.fail(
        new AppError({
          code: "FORBIDDEN",
          details: { internal: "authorization trace" },
          message: "You cannot edit this task.",
        })
      ),
      "req-test-001"
    );

    expect(result).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "You cannot edit this task.",
        requestId: "req-test-001",
      },
      ok: false,
    });
  });

  it("does not expose unexpected failures to the caller", async () => {
    const result = await runEffectResult(
      Effect.die(new Error("database password=secret")),
      "req-test-002"
    );

    expect(result).toEqual({
      error: {
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
        requestId: "req-test-002",
      },
      ok: false,
    });
  });
});

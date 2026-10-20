import { describe, expect, it, spyOn } from "bun:test";

import { Effect } from "effect";

import { AppError, runEffectResult } from "../../src/server/core/action-result";

const captureStderr = async (run: () => Promise<unknown>) => {
  const lines: string[] = [];
  const spy = spyOn(process.stderr, "write").mockImplementation((chunk) => {
    lines.push(String(chunk));
    return true;
  });
  try {
    await run();
  } finally {
    spy.mockRestore();
  }
  return lines;
};

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

  it("logs an unexpected defect with its request ID and full cause", async () => {
    const lines = await captureStderr(() =>
      runEffectResult(Effect.die(new Error("pool exhausted")), "req-test-003")
    );

    expect(lines).toHaveLength(1);
    const entry: unknown = JSON.parse(lines[0] ?? "");
    expect(entry).toMatchObject({
      error: { message: "pool exhausted", name: "Error" },
      level: "error",
      requestId: "req-test-003",
    });
    expect(entry).toHaveProperty(
      "cause",
      expect.stringContaining("pool exhausted")
    );
  });

  it("does not log expected application errors", async () => {
    const lines = await captureStderr(() =>
      runEffectResult(
        Effect.fail(new AppError({ code: "NOT_FOUND", message: "Missing." })),
        "req-test-004"
      )
    );

    expect(lines).toEqual([]);
  });
});

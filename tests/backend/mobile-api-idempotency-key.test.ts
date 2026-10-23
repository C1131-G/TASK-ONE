import { expect, it } from "bun:test";

import { Effect } from "effect";

import { readIdempotencyKey } from "../../src/server/api/idempotency-key";
import { runEffectResult } from "../../src/server/core/action-result";

const readWith = (headers: Record<string, string>) =>
  runEffectResult(
    readIdempotencyKey(new Headers(headers)),
    "req-idempotency-key"
  );

it("returns the key the app sent for a write", async () => {
  expect(await readWith({ "idempotency-key": "retry-key-0001" })).toEqual({
    data: "retry-key-0001",
    ok: true,
    requestId: "req-idempotency-key",
  });
});

it("refuses a write that has no key", async () => {
  expect(await readWith({})).toMatchObject({
    error: {
      code: "VALIDATION_FAILED",
      fieldErrors: { "Idempotency-Key": expect.any(String) },
    },
    ok: false,
  });
});

it("refuses a key that is too short or too long to deduplicate safely", async () => {
  expect(await readWith({ "idempotency-key": "short" })).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  expect(await readWith({ "idempotency-key": "k".repeat(129) })).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
});

it("is an Effect, so a route can chain it before any write runs", async () => {
  const program = Effect.map(
    readIdempotencyKey(new Headers({ "idempotency-key": "retry-key-0002" })),
    (key) => key.length
  );

  expect(await Effect.runPromise(program)).toBe(14);
});

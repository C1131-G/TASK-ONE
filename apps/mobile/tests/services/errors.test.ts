import { it } from "@effect/vitest";
import { Cause, Effect, Exit, Option } from "effect";
import { expect } from "vitest";

import { MobileApiError, createMobileClient } from "@api/client";
import { ERROR_CODES, type AppErrorCode } from "@api/route-definition";
import {
  AppFailure,
  Conflict,
  RateLimited,
  Unavailable,
  ValidationFailed,
  fromMobileApiError,
} from "@/errors";

const EXPECTED_TAGS: Record<AppErrorCode, string> = {
  UNAUTHENTICATED: "Unauthenticated",
  FORBIDDEN: "Forbidden",
  NOT_FOUND: "NotFound",
  VALIDATION_FAILED: "ValidationFailed",
  CONFLICT: "Conflict",
  RATE_LIMITED: "RateLimited",
  UNAVAILABLE: "Unavailable",
};

const errorWith = (
  code: AppErrorCode,
  fieldErrors?: Readonly<Record<string, string>>,
): MobileApiError =>
  new MobileApiError(400, { code, message: "broken", requestId: "req-1", fieldErrors });

it.effect("maps every app error code to its tagged failure", () =>
  Effect.gen(function* () {
    for (const code of ERROR_CODES) {
      const failure = yield* Effect.sync(() => fromMobileApiError(errorWith(code)));

      expect(failure._tag, code).toBe(EXPECTED_TAGS[code]);
    }
  }),
);

it.effect("carries the failure details each screen needs", () =>
  Effect.gen(function* () {
    const validation = yield* Effect.sync(() =>
      fromMobileApiError(errorWith("VALIDATION_FAILED", { title: "Required" })),
    );

    expect(validation._tag).toBe("ValidationFailed");
    expect((validation as ValidationFailed).fieldErrors).toEqual({ title: "Required" });

    const unavailable = yield* Effect.sync(() =>
      fromMobileApiError(errorWith("UNAVAILABLE")),
    );

    expect((unavailable as Unavailable).requestId).toBe("req-1");
  }),
);

it("constructs the optional-field failures the screens match on", () => {
  const conflict: AppFailure = new Conflict({ currentVersion: 4 });
  const stale: AppFailure = new Conflict({});
  const limited: AppFailure = new RateLimited({ retryAfter: 30 });
  const blocked: AppFailure = new RateLimited({});

  expect([conflict, stale, limited, blocked].map((error) => error._tag)).toEqual([
    "Conflict",
    "Conflict",
    "RateLimited",
    "RateLimited",
  ]);
});

it("maps a foreign error to Unavailable", () => {
  expect(fromMobileApiError(new Error("not ours"))._tag).toBe("Unavailable");
});

it.effect("maps a malformed envelope through the client to Unavailable", () =>
  Effect.gen(function* () {
    const client = createMobileClient({
      baseUrl: "https://unit.test",
      fetch: () => Promise.resolve(new Response("<html>gone</html>", { status: 502 })),
      token: "token",
    });
    const program = Effect.tryPromise({
      catch: (error) => fromMobileApiError(error),
      try: () => client.getMe(),
    });
    const exit = yield* Effect.exit(program);
    const failure = Exit.isSuccess(exit)
      ? null
      : Option.getOrUndefined(Cause.findErrorOption(exit.cause));

    expect(failure?._tag).toBe("Unavailable");
  }),
);

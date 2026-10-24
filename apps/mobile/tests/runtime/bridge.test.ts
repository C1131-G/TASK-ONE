import { QueryClient } from "@tanstack/react-query";
import type { DefaultError } from "@tanstack/react-query";
import { Cause, Effect, Exit, Match, Option } from "effect";
import { describe, expect, it } from "vitest";

import {
  Conflict,
  DecodeFailure,
  Forbidden,
  NotFound,
  Offline,
  RateLimited,
  StorageFailure,
  Unauthenticated,
  Unavailable,
  ValidationFailed,
  type AppFailure,
} from "@/errors";
import { makeBridge } from "@/runtime/bridge";
import { makeTestRuntime } from "@/runtime/test-layer";

const makeQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

describe("the React bridge", () => {
  it("rejects queries with the tagged failure", async () => {
    const runtime = makeTestRuntime();
    const bridge = makeBridge(runtime);
    const options = bridge.queryOptions({
      queryKey: ["test", "unauthenticated"],
      program: Effect.fail(new Unauthenticated()),
    });

    let caught: unknown = null;
    try {
      await makeQueryClient().fetchQuery(options);
    } catch (error) {
      caught = error;
    }

    expect((caught as AppFailure)._tag).toBe("Unauthenticated");
    await runtime.dispose();
  });

  it("resolves queries with the program value", async () => {
    const runtime = makeTestRuntime();
    const bridge = makeBridge(runtime);
    const options = bridge.queryOptions({
      queryKey: ["test", "value"],
      program: Effect.succeed(41),
    });

    const value = await makeQueryClient().fetchQuery(options);

    expect(value).toBe(41);
    await runtime.dispose();
  });

  it("returns an Exit from mutations for rollback matching", async () => {
    const runtime = makeTestRuntime();
    const bridge = makeBridge(runtime);
    const double = bridge.mutationOptions({
      program: (input: number) => Effect.succeed(input * 2),
    });
    const refuse = bridge.mutationOptions({
      mutationKey: ["test", "refuse"],
      program: () => Effect.fail(new Forbidden()) as Effect.Effect<number, AppFailure>,
    });

    const doubleFn = double.mutationFn;
    const refuseFn = refuse.mutationFn;
    const context = { client: makeQueryClient(), meta: undefined };
    const success = doubleFn === undefined ? null : await doubleFn(21, context);
    const failure = refuseFn === undefined ? null : await refuseFn(undefined, context);

    expect(success).not.toBeNull();
    expect(failure).not.toBeNull();

    if (success !== null && failure !== null) {
      expect(Exit.isSuccess(success) ? success.value : null).toBe(42);
      expect(
        Exit.isFailure(failure)
          ? Option.getOrUndefined(Cause.findErrorOption(failure.cause))?._tag
          : null,
      ).toBe("Forbidden");
    }
    await runtime.dispose();
  });

  it("matches every AppFailure tag", () => {
    const failures: readonly AppFailure[] = [
      new Unauthenticated(),
      new Forbidden(),
      new NotFound(),
      new ValidationFailed({ fieldErrors: {} }),
      new Conflict({ currentVersion: 1 }),
      new RateLimited({}),
      new Unavailable({ requestId: "r" }),
      new Offline(),
      new StorageFailure({}),
      new DecodeFailure({}),
    ];
    const labels = failures.map((failure) =>
      Match.valueTags(failure, {
        Unauthenticated: () => "unauthenticated",
        Forbidden: () => "forbidden",
        NotFound: () => "not-found",
        ValidationFailed: () => "validation-failed",
        Conflict: () => "conflict",
        RateLimited: () => "rate-limited",
        Unavailable: () => "unavailable",
        Offline: () => "offline",
        StorageFailure: () => "storage-failure",
        DecodeFailure: () => "decode-failure",
      }),
    );

    expect(labels).toEqual([
      "unauthenticated",
      "forbidden",
      "not-found",
      "validation-failed",
      "conflict",
      "rate-limited",
      "unavailable",
      "offline",
      "storage-failure",
      "decode-failure",
    ]);
  });

  it("registers AppFailure as TanStack's default error", () => {
    const asDefault = null as unknown as DefaultError;
    const asAppFailure: AppFailure = asDefault;

    expect(asAppFailure).toBeNull();
  });

  it("interrupts running fibers on dispose", async () => {
    const runtime = makeTestRuntime();
    const sleeping = runtime.runPromise(Effect.sleep("10 minutes"));

    await runtime.dispose();

    const outcome = await sleeping.then(
      () => "completed",
      (error) => (error instanceof Error ? error.name : String(error)),
    );

    expect(outcome).not.toBe("completed");
  });
});

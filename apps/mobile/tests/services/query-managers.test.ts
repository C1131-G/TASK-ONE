import { onlineManager } from "@tanstack/react-query";
import { Effect, Stream, SubscriptionRef } from "effect";
import { describe, expect, it } from "vitest";

import { makeAppLifecycleTest } from "@/services/app-lifecycle";
import { makeConnectivityTest } from "@/services/connectivity";
import { queryManagerWiring } from "@/runtime/query-managers";

// One program runs the wiring and the driver together; the driver finishing
// interrupts the never-ending wiring inside the same runtime.
const driveWith = (
  wiring: Parameters<typeof queryManagerWiring>[0],
  driver: Effect.Effect<void>,
): Effect.Effect<void> => Effect.race(queryManagerWiring(wiring), driver);

describe("the query manager wiring", () => {
  it("pushes connectivity changes into online state", async () => {
    const connectivity = await Effect.runPromise(makeConnectivityTest());
    const lifecycle = await Effect.runPromise(makeAppLifecycleTest());
    const onlineValues: boolean[] = [];

    await Effect.runPromise(
      driveWith(
        {
          connectivity,
          lifecycle,
          setOnline: (online) => onlineValues.push(online),
        },
        Effect.gen(function* () {
          yield* Effect.sleep("50 millis");
          yield* SubscriptionRef.set(connectivity.ref, false);
          yield* Effect.sleep("50 millis");
        }),
      ),
    );

    expect(onlineValues).toEqual([true, false]);
    expect(onlineManager.isOnline()).toBe(true);
  });

  it("pushes lifecycle changes into focus state", async () => {
    const connectivity = await Effect.runPromise(makeConnectivityTest());
    const lifecycle = await Effect.runPromise(makeAppLifecycleTest());
    const focusValues: boolean[] = [];

    await Effect.runPromise(
      driveWith(
        {
          connectivity,
          lifecycle,
          setFocused: (focused) => focusValues.push(focused),
        },
        Effect.gen(function* () {
          yield* Effect.sleep("50 millis");
          yield* SubscriptionRef.set(lifecycle.ref, "background");
          yield* Effect.sleep("50 millis");
        }),
      ),
    );

    expect(focusValues).toEqual([true, false]);
  });

  it("streams start with the current value", async () => {
    const connectivity = await Effect.runPromise(makeConnectivityTest());
    await Effect.runPromise(SubscriptionRef.set(connectivity.ref, false));

    const first = await Effect.runPromise(
      Effect.map(Stream.runHead(connectivity.changes), (head) =>
        head._tag === "Some" ? head.value : null,
      ),
    );

    expect(first).toBe(false);
  });
});

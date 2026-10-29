import { Context, Effect, Layer } from "effect";

import type { AppFailure } from "@/errors";

/**
 * Registers web-push subscriptions for the signed-in account. The server
 * endpoint is still pending, so the stub layer records the intent for tests
 * until the route lands.
 */
export class Push extends Context.Service<
  Push,
  {
    /** Registers this device's push endpoint with the account. */
    readonly register: (endpoint: string) => Effect.Effect<void, AppFailure>;
    /** Removes this device's push endpoint. */
    readonly unregister: (endpoint: string) => Effect.Effect<void, AppFailure>;
  }
>()("taskora/mobile/Push") {}

/** The recorded calls of the stub push service. */
export interface PushStubCalls {
  readonly registered: readonly string[];
  readonly unregistered: readonly string[];
}

/** A stub layer that records calls instead of hitting the network. */
export const makePushStub = (): Layer.Layer<Push> =>
  Layer.effect(
    Push,
    Effect.sync(() => {
      const calls = { registered: [] as string[], unregistered: [] as string[] };
      return Push.of({
        register: (endpoint) =>
          Effect.sync(() => {
            calls.registered.push(endpoint);
          }),
        unregister: (endpoint) =>
          Effect.sync(() => {
            calls.unregistered.push(endpoint);
          }),
      });
    }),
  );


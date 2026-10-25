import { Context, Effect, Layer } from "effect";

import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

/**
 * Registers web-push subscriptions for the signed-in account. The server
 * endpoint is still pending; registerThroughApi posts through the API when
 * the route lands, and the stub layer records the intent for tests.
 */
export class Push extends Context.Service<
  Push,
  {
    /** Registers this device's push endpoint with the account. */
    readonly register: (endpoint: string) => Effect.Effect<void, AppFailure>;
    /** Removes this device's push endpoint. */
    readonly unregister: (endpoint: string) => Effect.Effect<void, AppFailure>;
  }
>()("metsys/mobile/Push") {}

interface RegistrationClient {
  readonly registerPush: (input: {
    readonly body: { readonly endpoint: string };
    readonly idempotencyKey: string;
  }) => Promise<{ readonly ok: true }>;
  readonly unregisterPush: (input: {
    readonly body: { readonly endpoint: string };
    readonly idempotencyKey: string;
  }) => Promise<{ readonly ok: true }>;
}

const makeLive = (api: MobileApi["Service"]): Push["Service"] => ({
  register: (endpoint) =>
    api.call((client) =>
      (client as unknown as RegistrationClient).registerPush({
        body: { endpoint },
        idempotencyKey: `push-reg-${endpoint.length}`,
      }),
    ),
  unregister: (endpoint) =>
    api.call((client) =>
      (client as unknown as RegistrationClient).unregisterPush({
        body: { endpoint },
        idempotencyKey: `push-unreg-${endpoint.length}`,
      }),
    ),
});

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


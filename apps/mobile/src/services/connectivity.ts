import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

/**
 * Reports whether the device has network access. The live layer follows
 * NetInfo; tests build one from a subscription ref they control.
 */
export class Connectivity extends Context.Service<
  Connectivity,
  {
    /** Emits every online/offline change, starting with the current value. */
    readonly changes: Stream.Stream<boolean>;
    readonly isOnline: Effect.Effect<boolean>;
  }
>()("metsys/mobile/Connectivity") {}

/** The service value screens and wiring receive. */
export type ConnectivityService = Connectivity["Service"];

const makeRef = (): Effect.Effect<SubscriptionRef.SubscriptionRef<boolean>> =>
  SubscriptionRef.make(true);

const makeFromRef = (ref: SubscriptionRef.SubscriptionRef<boolean>) =>
  Connectivity.of({
    changes: SubscriptionRef.changes(ref),
    isOnline: SubscriptionRef.get(ref),
  });

export const makeConnectivityTest = (): Effect.Effect<
  ConnectivityService & { readonly ref: SubscriptionRef.SubscriptionRef<boolean> }
> => Effect.map(makeRef(), (ref) => ({ ...makeFromRef(ref), ref }));

/** NetInfo-backed live layer; the native module import stays deferred. */
export const ConnectivityLive: Layer.Layer<Connectivity> = Layer.effect(
  Connectivity,
  Effect.gen(function* () {
    const netInfo = yield* Effect.promise(() => import("@react-native-community/netinfo"));
    const ref = yield* makeRef();
    const unsubscribe = netInfo.addEventListener((state) => {
      Effect.runFork(SubscriptionRef.set(ref, state.isConnected ?? true));
    });
    yield* Effect.addFinalizer(() => Effect.sync(() => unsubscribe()));
    return makeFromRef(ref);
  }),
);

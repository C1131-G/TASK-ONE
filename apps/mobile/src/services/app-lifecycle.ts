import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect";

/** The app's foreground/background state. */
export type LifecycleState = "active" | "background";

/**
 * Reports the app's foreground/background state. The live layer follows
 * AppState; tests build one from a subscription ref they control.
 */
export class AppLifecycle extends Context.Service<
  AppLifecycle,
  {
    readonly changes: Stream.Stream<LifecycleState>;
    readonly isActive: Effect.Effect<boolean>;
  }
>()("metsys/mobile/AppLifecycle") {}

/** The service value screens and wiring receive. */
export type AppLifecycleService = AppLifecycle["Service"];

const makeRef = (): Effect.Effect<SubscriptionRef.SubscriptionRef<LifecycleState>> =>
  SubscriptionRef.make<LifecycleState>("active");

const makeFromRef = (ref: SubscriptionRef.SubscriptionRef<LifecycleState>) =>
  AppLifecycle.of({
    changes: SubscriptionRef.changes(ref),
    isActive: Effect.map(SubscriptionRef.get(ref), (state) => state === "active"),
  });

export const makeAppLifecycleTest = (): Effect.Effect<
  AppLifecycleService & { readonly ref: SubscriptionRef.SubscriptionRef<LifecycleState> }
> => Effect.map(makeRef(), (ref) => ({ ...makeFromRef(ref), ref }));

/** AppState-backed live layer; the native module import stays deferred. */
export const AppLifecycleLive: Layer.Layer<AppLifecycle> = Layer.effect(
  AppLifecycle,
  Effect.gen(function* () {
    const appState = yield* Effect.promise(() => import("react-native"));
    const ref = yield* makeRef();
    const unsubscribe = appState.AppState.addEventListener(
      "change",
      (state: import("react-native").AppStateStatus) => {
        Effect.runFork(SubscriptionRef.set(ref, state === "active" ? "active" : "background"));
      },
    );
    yield* Effect.addFinalizer(() => Effect.sync(() => unsubscribe.remove()));
    return makeFromRef(ref);
  }),
);

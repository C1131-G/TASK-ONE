import { Context, Effect, Layer } from "effect";

/**
 * Haptic feedback through expo-haptics, wrapped once behind a service so
 * screens never import the native module and tests get a recording stub.
 */
export class Haptics extends Context.Service<
  Haptics,
  {
    /** A light impact: small confirmations, toggles. */
    readonly light: Effect.Effect<void>;
    /** A medium impact: completing a move or submit. */
    readonly medium: Effect.Effect<void>;
    /** A success notification: a write landed. */
    readonly success: Effect.Effect<void>;
    /** A warning notification: a conflict or refused action. */
    readonly warning: Effect.Effect<void>;
  }
>()("metsys/mobile/Haptics") {}

/** The recorded calls of the stub layer. */
export interface HapticsCalls {
  readonly events: readonly string[];
}

/** A stub layer that records events instead of vibrating. */
export const makeHapticsStub = (): Layer.Layer<Haptics> =>
  Layer.effect(
    Haptics,
    Effect.sync(() => {
      const events: string[] = [];
      const fire = (event: string): Effect.Effect<void> =>
        Effect.sync(() => {
          events.push(event);
        });
      return Haptics.of({
        light: fire("light"),
        medium: fire("medium"),
        success: fire("success"),
        warning: fire("warning"),
      });
    }),
  );

/** The live layer; the expo-haptics import stays deferred for Node tests. */
export const HapticsLive: Layer.Layer<Haptics> = Layer.effect(
  Haptics,
  Effect.gen(function* () {
    const native = yield* Effect.promise(() => import("expo-haptics"));
    const fire = (run: () => Promise<unknown>): Effect.Effect<void> =>
      Effect.asVoid(Effect.promise(() => run()));
    return Haptics.of({
      light: fire(() => native.impactAsync(native.ImpactFeedbackStyle.Light)),
      medium: fire(() => native.impactAsync(native.ImpactFeedbackStyle.Medium)),
      success: fire(() => native.notificationAsync(native.NotificationFeedbackType.Success)),
      warning: fire(() => native.notificationAsync(native.NotificationFeedbackType.Warning)),
    });
  }),
);

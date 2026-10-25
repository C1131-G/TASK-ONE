import { it } from "@effect/vitest";
import { Effect } from "effect";
import { describe, expect } from "vitest";

import { Haptics, makeHapticsStub } from "@/services/haptics";
import { appMotion, durationFor, parseCubicBezier } from "@/theme/motion";
import { motion } from "@/theme/tokens.generated";

describe("the motion vocabulary", () => {
  it("parses the generated cubic-bezier tokens", () => {
    const points = parseCubicBezier(motion.ease);

    expect(points.x1).toBeCloseTo(0.23, 5);
    expect(points.y1).toBeCloseTo(1, 5);
    expect(points.x2).toBeCloseTo(0.32, 5);
    expect(points.y2).toBeCloseTo(1, 5);
  });

  it("falls back to a sane curve for unknown values", () => {
    const points = parseCubicBezier("linear");

    expect(points.x1).toBeGreaterThanOrEqual(0);
    expect(points.x2).toBeLessThanOrEqual(1);
  });

  it("carries the web duration and disables it under reduced motion", () => {
    expect(appMotion.durations.standard).toBe(140);
    expect(durationFor(true)).toBe(0);
    expect(durationFor(false)).toBe(140);
  });

  it("exposes a bezier tuple per motion token for Reanimated", () => {
    expect(appMotion.bezier.standard).toEqual([0.23, 1, 0.32, 1]);
    expect(appMotion.bezier.spring).toHaveLength(4);
    expect(appMotion.bezier.drawer).toHaveLength(4);
  });
});

it.effect("the haptics stub fires each event kind without the native module", () =>
  Effect.gen(function* () {
    const haptics = yield* Effect.service(Haptics);

    yield* haptics.light;
    yield* haptics.medium;
    yield* haptics.success;
    yield* haptics.warning;

    expect(true).toBe(true);
  }).pipe(Effect.provide(makeHapticsStub())),
);

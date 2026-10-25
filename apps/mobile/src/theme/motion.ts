import { motion } from "@/theme/tokens.generated";

/** The parsed control points of one CSS cubic-bezier token. */
export interface BezierPoints {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

/** Parses "cubic-bezier(x1, y1, x2, y2)" from the generated motion tokens. */
export const parseCubicBezier = (value: string): BezierPoints => {
  const match = /cubic-bezier\((-?[\d.]+), (-?[\d.]+), (-?[\d.]+), (-?[\d.]+)\)/u.exec(value);
  if (match === null) {
    return { x1: 0.25, x2: 0.75, y1: 0.1, y2: 0.9 };
  }
  const [x1 = 0.25, y1 = 0.1, x2 = 0.75, y2 = 0.9] = match
    .slice(1)
    .map((part) => Number.parseFloat(part ?? "0"));
  return { x1, x2, y1, y2 };
};

/** The control-point tuple Reanimated's Easing.bezier wants. */
export type BezierTuple = readonly [number, number, number, number];

const tupleOf = (value: string): BezierTuple => {
  const points = parseCubicBezier(value);
  return [points.x1, points.y1, points.x2, points.y2];
};

/** The app's motion vocabulary, generated from the web tokens. */
export const appMotion = {
  /** The bezier tuples per named easing; motion.reanimated.ts turns these into Easings. */
  bezier: {
    drawer: tupleOf(motion.easeDrawer),
    standard: tupleOf(motion.ease),
    spring: tupleOf(motion.spring),
  },
  durations: {
    /** The one shared duration, --dur. */
    standard: motion.dur,
    /** What a reduced-motion user experiences instead of animating. */
    reduced: 0,
  },
} as const;

/** Picks the duration honoring the reduced-motion preference. */
export const durationFor = (reducedMotion: boolean): number =>
  reducedMotion ? appMotion.durations.reduced : appMotion.durations.standard;

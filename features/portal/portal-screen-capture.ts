import type { Point, Size } from "@/features/portal/portal-screenshot-geometry";

// Phones and some desktop browsers cannot share a tab or window. Asking the
// object itself (rather than the user agent) keeps this honest as that changes.
export const canCaptureScreen = (mediaDevices?: unknown): boolean =>
  typeof mediaDevices === "object" &&
  mediaDevices !== null &&
  "getDisplayMedia" in mediaDevices &&
  typeof mediaDevices.getDisplayMedia === "function";

interface StoppableStream {
  readonly getTracks: () => readonly { readonly stop: () => void }[];
}

// Ends the share as soon as one frame is taken, so the browser's "sharing"
// indicator does not stay on.
export const stopStream = (stream: StoppableStream): void => {
  for (const track of stream.getTracks()) {
    track.stop();
  }
};

const KEY_STEP = 10;
const KEY_STEP_LARGE = 50;

const DIRECTIONS: Readonly<Record<string, Point>> = {
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
};

// Moves the keyboard drawing cursor, so marks can be made without a pointer.
export const moveCursor = (
  from: Point,
  key: string,
  large: boolean,
  bounds: Size
): Point => {
  const direction = DIRECTIONS[key];
  if (!direction) {
    return from;
  }
  const step = large ? KEY_STEP_LARGE : KEY_STEP;
  return {
    x: Math.min(bounds.width, Math.max(0, from.x + direction.x * step)),
    y: Math.min(bounds.height, Math.max(0, from.y + direction.y * step)),
  };
};

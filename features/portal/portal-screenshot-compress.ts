import { fitWithin } from "@/features/portal/portal-screenshot-geometry";
import type { Size } from "@/features/portal/portal-screenshot-geometry";

// Wider than a normal laptop screen keeps text readable; below the floor a
// screenshot stops being useful, so compression gives up there.
export const SCREENSHOT_LONGEST_EDGE = 1920;
const SHRINK_FACTOR = 0.75;
const MIN_LONGEST_EDGE = 480;

export interface CompressedScreenshot {
  readonly blob: Blob;
  readonly size: Size;
}

// Encodes the screenshot at the largest size that fits the upload limit. The
// encoder is injected (it draws and exports the canvas), so this is pure.
export const compressScreenshot = async ({
  encode,
  maxBytes,
  size,
}: {
  readonly encode: (size: Size) => Promise<Blob | null>;
  readonly maxBytes: number;
  readonly size: Size;
}): Promise<CompressedScreenshot | null> => {
  let edge = SCREENSHOT_LONGEST_EDGE;
  while (edge >= MIN_LONGEST_EDGE) {
    const target = fitWithin(size, edge);
    // Each size is tried only after the larger one was too big.
    // oxlint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop -- Sequential on purpose.
    const blob = await encode(target);
    if (!blob) {
      return null;
    }
    if (blob.size <= maxBytes) {
      return { blob, size: target };
    }
    edge = Math.floor(edge * SHRINK_FACTOR);
  }
  return null;
};

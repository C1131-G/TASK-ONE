export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly height: number;
  readonly width: number;
}

export interface ShownBox extends Size {
  readonly left: number;
  readonly top: number;
}

export interface Rect extends Point, Size {}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

// Shrinks a size so its longest edge fits, keeping the aspect ratio. A smaller
// image is left alone, and no side drops below one pixel.
export const fitWithin = (size: Size, longestEdge: number): Size => {
  const longest = Math.max(size.width, size.height);
  if (longest <= longestEdge) {
    return size;
  }
  const scale = longestEdge / longest;
  return {
    height: Math.max(1, Math.round(size.height * scale)),
    width: Math.max(1, Math.round(size.width * scale)),
  };
};

// The canvas is drawn at its own pixel size but shown at another, so a pointer
// position on screen is scaled back to canvas pixels.
export const toCanvasPoint = (
  pointer: Point,
  shown: ShownBox,
  pixels: Size
): Point => ({
  x: clamp(
    ((pointer.x - shown.left) / shown.width) * pixels.width,
    0,
    pixels.width
  ),
  y: clamp(
    ((pointer.y - shown.top) / shown.height) * pixels.height,
    0,
    pixels.height
  ),
});

export const normalizeRect = (from: Point, to: Point): Rect => ({
  height: Math.abs(to.y - from.y),
  width: Math.abs(to.x - from.x),
  x: Math.min(from.x, to.x),
  y: Math.min(from.y, to.y),
});

const BARB_ANGLE = Math.PI / 6;

// The two points that, joined to the tip, form the arrowhead.
export const arrowHead = (
  from: Point,
  to: Point,
  size: number
): readonly [Point, Point] => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const barb = (offset: number): Point => ({
    x: to.x - size * Math.cos(angle + offset),
    y: to.y - size * Math.sin(angle + offset),
  });
  return [barb(-BARB_ANGLE), barb(BARB_ANGLE)];
};

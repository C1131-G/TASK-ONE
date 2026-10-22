import { expect, it } from "bun:test";

import {
  arrowHead,
  fitWithin,
  normalizeRect,
  toCanvasPoint,
} from "@/features/portal/portal-screenshot-geometry";

it("downscales to the longest edge and keeps the aspect ratio", () => {
  expect(fitWithin({ height: 1080, width: 3840 }, 1920)).toEqual({
    height: 540,
    width: 1920,
  });
  expect(fitWithin({ height: 2000, width: 1000 }, 1000)).toEqual({
    height: 1000,
    width: 500,
  });
});

it("never upscales and never returns an empty size", () => {
  expect(fitWithin({ height: 300, width: 400 }, 1920)).toEqual({
    height: 300,
    width: 400,
  });
  expect(fitWithin({ height: 1, width: 5000 }, 1000)).toEqual({
    height: 1,
    width: 1000,
  });
});

it("maps a pointer position on the shown canvas to canvas pixels", () => {
  const shown = { height: 300, left: 100, top: 50, width: 400 };
  const pixels = { height: 600, width: 800 };
  expect(toCanvasPoint({ x: 300, y: 200 }, shown, pixels)).toEqual({
    x: 400,
    y: 300,
  });
});

it("keeps mapped points inside the canvas", () => {
  const shown = { height: 300, left: 100, top: 50, width: 400 };
  const pixels = { height: 600, width: 800 };
  expect(toCanvasPoint({ x: 0, y: 9999 }, shown, pixels)).toEqual({
    x: 0,
    y: 600,
  });
});

it("builds a rectangle whichever corner the drag started from", () => {
  expect(normalizeRect({ x: 50, y: 40 }, { x: 10, y: 90 })).toEqual({
    height: 50,
    width: 40,
    x: 10,
    y: 40,
  });
});

it("places the two arrowhead barbs behind the tip", () => {
  const [upper, lower] = arrowHead(
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    10
  ).toSorted((first, second) => first.y - second.y);
  // A 10px barb at 30 degrees sits 8.66px back and 5px to either side.
  expect(upper?.x).toBeCloseTo(91.34);
  expect(upper?.y).toBeCloseTo(-5);
  expect(lower?.x).toBeCloseTo(91.34);
  expect(lower?.y).toBeCloseTo(5);
});

it("gives a zero-length arrow barbs on the tip instead of NaN", () => {
  const [left, right] = arrowHead({ x: 5, y: 5 }, { x: 5, y: 5 }, 10);
  expect(Number.isNaN(left.x) || Number.isNaN(right.y)).toBe(false);
});

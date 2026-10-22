import { expect, it } from "bun:test";

import {
  addAnnotation,
  clearAnnotations,
  drawAnnotation,
  extendAnnotation,
  startAnnotation,
  undoAnnotation,
} from "@/features/portal/portal-screenshot-annotations";
import type {
  Annotation,
  DrawingSurface,
} from "@/features/portal/portal-screenshot-annotations";

const recordingSurface = () => {
  const calls: string[] = [];
  const surface: DrawingSurface = {
    beginPath: () => calls.push("beginPath"),
    lineCap: "butt",
    lineJoin: "miter",
    lineTo: (x, y) => calls.push(`lineTo ${x},${y}`),
    lineWidth: 1,
    moveTo: (x, y) => calls.push(`moveTo ${x},${y}`),
    stroke: () => calls.push("stroke"),
    strokeRect: (x, y, width, height) =>
      calls.push(`strokeRect ${x},${y},${width},${height}`),
    strokeStyle: "",
  };
  return { calls, surface };
};

it("grows a pen stroke point by point and resizes shapes from their start", () => {
  const pen = extendAnnotation(
    extendAnnotation(startAnnotation("pen", { x: 1, y: 1 }), { x: 2, y: 2 }),
    { x: 3, y: 3 }
  );
  expect(pen).toEqual({
    kind: "pen",
    points: [
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ],
  });
  const box = extendAnnotation(
    extendAnnotation(startAnnotation("rectangle", { x: 5, y: 5 }), {
      x: 9,
      y: 9,
    }),
    { x: 20, y: 30 }
  );
  expect(box).toEqual({
    from: { x: 5, y: 5 },
    kind: "rectangle",
    to: { x: 20, y: 30 },
  });
});

it("undoes the last mark and clears them all without touching the input", () => {
  const first = extendAnnotation(startAnnotation("arrow", { x: 0, y: 0 }), {
    x: 9,
    y: 9,
  });
  const second = extendAnnotation(startAnnotation("pen", { x: 4, y: 4 }), {
    x: 6,
    y: 6,
  });
  const marks = addAnnotation(addAnnotation([], first), second);
  expect(marks).toHaveLength(2);
  expect(undoAnnotation(marks)).toEqual([first]);
  expect(marks).toHaveLength(2);
  expect(undoAnnotation([])).toEqual([]);
  expect(clearAnnotations()).toEqual([]);
});

it("ignores a mark that was only a click", () => {
  const click = startAnnotation("rectangle", { x: 5, y: 5 });
  expect(addAnnotation([], click)).toEqual([]);
  const dot = startAnnotation("pen", { x: 5, y: 5 });
  expect(addAnnotation([], dot)).toEqual([]);
});

it("draws a pen stroke as a connected path", () => {
  const { calls, surface } = recordingSurface();
  const pen: Annotation = {
    kind: "pen",
    points: [
      { x: 1, y: 2 },
      { x: 3, y: 4 },
    ],
  };
  drawAnnotation(surface, pen);
  expect(calls).toEqual(["beginPath", "moveTo 1,2", "lineTo 3,4", "stroke"]);
  expect(surface.lineWidth).toBeGreaterThan(1);
  expect(surface.strokeStyle).not.toBe("");
});

it("draws a rectangle from any drag direction", () => {
  const { calls, surface } = recordingSurface();
  drawAnnotation(surface, {
    from: { x: 50, y: 40 },
    kind: "rectangle",
    to: { x: 10, y: 90 },
  });
  expect(calls).toEqual(["strokeRect 10,40,40,50"]);
});

it("draws an arrow as a shaft plus two barbs", () => {
  const { calls, surface } = recordingSurface();
  drawAnnotation(surface, {
    from: { x: 0, y: 0 },
    kind: "arrow",
    to: { x: 100, y: 0 },
  });
  expect(calls.filter((call) => call.startsWith("moveTo"))).toHaveLength(2);
  expect(calls.at(-1)).toBe("stroke");
  expect(calls).toContain("lineTo 100,0");
});

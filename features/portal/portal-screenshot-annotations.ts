import {
  arrowHead,
  normalizeRect,
} from "@/features/portal/portal-screenshot-geometry";
import type { Point } from "@/features/portal/portal-screenshot-geometry";

export type Annotation =
  | { readonly kind: "pen"; readonly points: readonly Point[] }
  | { readonly kind: "rectangle"; readonly from: Point; readonly to: Point }
  | { readonly kind: "arrow"; readonly from: Point; readonly to: Point };

export type AnnotationTool = Annotation["kind"];

export const ANNOTATION_TOOLS: readonly AnnotationTool[] = [
  "pen",
  "rectangle",
  "arrow",
];

// The part of a 2D canvas context the marks need, so tests can pass a fake.
export interface DrawingSurface {
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  lineWidth: number;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  beginPath: () => void;
  lineTo: (x: number, y: number) => void;
  moveTo: (x: number, y: number) => void;
  stroke: () => void;
  strokeRect: (x: number, y: number, width: number, height: number) => void;
}

// A mark is drawn on a screenshot, not in the page, so it needs a colour that
// reads on both light and dark content and does not follow the theme tokens.
const MARK_COLOR = "#e5484d";
const MARK_WIDTH = 4;
const ARROW_HEAD = 22;

export const startAnnotation = (tool: AnnotationTool, at: Point): Annotation =>
  tool === "pen"
    ? { kind: "pen", points: [at] }
    : { from: at, kind: tool, to: at };

// Pens keep every point; shapes follow the pointer from where they began.
export const extendAnnotation = (
  annotation: Annotation,
  to: Point
): Annotation =>
  annotation.kind === "pen"
    ? { ...annotation, points: [...annotation.points, to] }
    : { ...annotation, to };

const isMark = (annotation: Annotation): boolean =>
  annotation.kind === "pen"
    ? annotation.points.length > 1
    : annotation.from.x !== annotation.to.x ||
      annotation.from.y !== annotation.to.y;

// A click without a drag leaves no mark, so it is not added.
export const addAnnotation = (
  annotations: readonly Annotation[],
  annotation: Annotation
): readonly Annotation[] =>
  isMark(annotation) ? [...annotations, annotation] : annotations;

export const undoAnnotation = (
  annotations: readonly Annotation[]
): readonly Annotation[] => annotations.slice(0, -1);

export const clearAnnotations = (): readonly Annotation[] => [];

const drawArrow = (surface: DrawingSurface, from: Point, to: Point): void => {
  const [left, right] = arrowHead(from, to, ARROW_HEAD);
  surface.beginPath();
  surface.moveTo(from.x, from.y);
  surface.lineTo(to.x, to.y);
  surface.moveTo(left.x, left.y);
  surface.lineTo(to.x, to.y);
  surface.lineTo(right.x, right.y);
  surface.stroke();
};

export const drawAnnotation = (
  surface: DrawingSurface,
  annotation: Annotation
): void => {
  surface.strokeStyle = MARK_COLOR;
  surface.lineWidth = MARK_WIDTH;
  surface.lineCap = "round";
  surface.lineJoin = "round";
  if (annotation.kind === "rectangle") {
    const { height, width, x, y } = normalizeRect(
      annotation.from,
      annotation.to
    );
    surface.strokeRect(x, y, width, height);
    return;
  }
  if (annotation.kind === "arrow") {
    drawArrow(surface, annotation.from, annotation.to);
    return;
  }
  const [first, ...rest] = annotation.points;
  if (!first) {
    return;
  }
  surface.beginPath();
  surface.moveTo(first.x, first.y);
  for (const point of rest) {
    surface.lineTo(point.x, point.y);
  }
  surface.stroke();
};

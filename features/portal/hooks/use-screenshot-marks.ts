import { useEffect, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";

import { moveCursor } from "@/features/portal/portal-screen-capture";
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
  AnnotationTool,
} from "@/features/portal/portal-screenshot-annotations";
import { toCanvasPoint } from "@/features/portal/portal-screenshot-geometry";
import type { Point } from "@/features/portal/portal-screenshot-geometry";

const toolNames: Readonly<Record<AnnotationTool, string>> = {
  arrow: "Arrow",
  pen: "Pen",
  rectangle: "Rectangle",
};

const CROSS_ARM = 12;

const drawCursor = (context: CanvasRenderingContext2D, at: Point) => {
  context.save();
  context.strokeStyle = "#ffffff";
  context.lineWidth = 6;
  context.beginPath();
  context.moveTo(at.x - CROSS_ARM, at.y);
  context.lineTo(at.x + CROSS_ARM, at.y);
  context.moveTo(at.x, at.y - CROSS_ARM);
  context.lineTo(at.x, at.y + CROSS_ARM);
  context.stroke();
  context.strokeStyle = "#111111";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
};

// Marks drawn on top of a captured frame, by pointer or by keyboard. The frame
// itself is never changed; marks are painted over it on every change.
export const useScreenshotMarks = (
  canvasRef: RefObject<HTMLCanvasElement | null>,
  base: HTMLCanvasElement
) => {
  const [tool, setTool] = useState<AnnotationTool>("pen");
  const [marks, setMarks] = useState<readonly Annotation[]>([]);
  const [draft, setDraft] = useState<Annotation | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const bounds = { height: base.height, width: base.width };

  // The canvas is an external drawing surface, so it is repainted here.
  // oxlint-disable-next-line react-doctor/no-event-handler -- Synchronises state with a canvas, not an event handler.
  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }
    context.drawImage(base, 0, 0);
    for (const mark of marks) {
      drawAnnotation(context, mark);
    }
    if (draft) {
      drawAnnotation(context, draft);
    }
    if (cursor) {
      drawCursor(context, cursor);
    }
  }, [base, canvasRef, cursor, draft, marks]);

  const commit = (annotation: Annotation) => {
    const next = addAnnotation(marks, annotation);
    setMarks(next);
    setDraft(null);
    setAnnouncement(
      next.length > marks.length
        ? `${toolNames[annotation.kind]} added. ${next.length} ${next.length === 1 ? "mark" : "marks"} on the screenshot.`
        : ""
    );
  };

  const pointFrom = (event: PointerEvent<HTMLCanvasElement>): Point =>
    toCanvasPoint(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
      bounds
    );

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setCursor(null);
    setDraft(startAnnotation(tool, pointFrom(event)));
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (draft) {
      setDraft(extendAnnotation(draft, pointFrom(event)));
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (draft) {
      commit(extendAnnotation(draft, pointFrom(event)));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const at = cursor ?? { x: bounds.width / 2, y: bounds.height / 2 };
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const moved = moveCursor(at, event.key, event.shiftKey, bounds);
      setCursor(moved);
      if (draft) {
        setDraft(extendAnnotation(draft, moved));
      }
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setCursor(at);
      if (draft) {
        commit(draft);
      } else {
        setDraft(startAnnotation(tool, at));
        setAnnouncement(
          `${toolNames[tool]} started. Move with the arrow keys, then press Space to finish.`
        );
      }
    } else if (event.key === "Escape" && draft) {
      event.preventDefault();
      event.stopPropagation();
      setDraft(null);
      setAnnouncement("Mark cancelled.");
    }
  };

  const undo = () => {
    setMarks(undoAnnotation(marks));
    setAnnouncement("Last mark removed.");
  };

  const clear = () => {
    setMarks(clearAnnotations());
    setAnnouncement("All marks removed.");
  };

  return {
    announcement,
    canvasHandlers: {
      onBlur: () => {
        setCursor(null);
        setDraft(null);
      },
      onKeyDown,
      onPointerCancel: () => setDraft(null),
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
    clear,
    marks,
    setTool,
    tool,
    undo,
  };
};

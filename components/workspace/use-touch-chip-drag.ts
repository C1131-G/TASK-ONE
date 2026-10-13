"use client";

import type { PointerEvent } from "react";
import { useEffect, useRef, useState } from "react";

// How long a finger must rest on a chip before the drag starts, and how far it
// may wander first. Moving sooner is a scroll, which is left to the browser.
const HOLD_MS = 350;
const SLOP_PX = 10;
const DAY_ATTRIBUTE = "data-day";
const OVER_ATTRIBUTE = "data-touch-over";

const dayUnder = (x: number, y: number): HTMLElement | null =>
  document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${DAY_ATTRIBUTE}]`) ??
  null;

const clearHighlight = () => {
  for (const element of document.querySelectorAll(`[${OVER_ATTRIBUTE}]`)) {
    element.removeAttribute(OVER_ATTRIBUTE);
  }
};

// A calendar chip dragged with a finger: hold, then drag onto a day. Mouse and
// pen keep using native drag and drop, which the chip also supports.
export const useTouchChipDrag = ({
  enabled,
  onDrop,
}: {
  readonly enabled: boolean;
  readonly onDrop: (day: string) => void;
}) => {
  const [dragging, setDragging] = useState(false);
  const state = useRef<{
    engaged: boolean;
    pointerId: number;
    startX: number;
    startY: number;
    timer: number | null;
  } | null>(null);
  const blockScroll = useRef((event: TouchEvent) => {
    if (state.current?.engaged && event.cancelable) {
      event.preventDefault();
    }
  });

  const finish = () => {
    const { current } = state;
    if (current?.timer !== null && current?.timer !== undefined) {
      window.clearTimeout(current.timer);
    }
    state.current = null;
    window.removeEventListener("touchmove", blockScroll.current);
    clearHighlight();
    setDragging(false);
  };

  useEffect(() => {
    const handler = blockScroll.current;
    return () => window.removeEventListener("touchmove", handler);
  }, []);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!enabled || event.pointerType !== "touch") {
      return;
    }
    const target = event.currentTarget;
    const { pointerId } = event;
    state.current = {
      engaged: false,
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      timer: window.setTimeout(() => {
        if (!state.current) {
          return;
        }
        state.current.engaged = true;
        target.setPointerCapture(pointerId);
        setDragging(true);
      }, HOLD_MS),
    };
    // Added now, before the first touchmove, so a held finger can stop the scroll.
    window.addEventListener("touchmove", blockScroll.current, {
      passive: false,
    });
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const { current } = state;
    if (!current || event.pointerId !== current.pointerId) {
      return;
    }
    if (!current.engaged) {
      const moved = Math.hypot(
        event.clientX - current.startX,
        event.clientY - current.startY
      );
      if (moved > SLOP_PX) {
        finish();
      }
      return;
    }
    clearHighlight();
    dayUnder(event.clientX, event.clientY)?.setAttribute(
      OVER_ATTRIBUTE,
      "true"
    );
  };

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    const { current } = state;
    if (!current || event.pointerId !== current.pointerId) {
      return;
    }
    const day = current.engaged
      ? dayUnder(event.clientX, event.clientY)?.getAttribute(DAY_ATTRIBUTE)
      : null;
    finish();
    if (day) {
      onDrop(day);
    }
  };

  return {
    dragging,
    handlers: {
      onPointerCancel: finish,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
  };
};

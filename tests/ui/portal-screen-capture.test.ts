import { expect, it } from "bun:test";

import {
  canCaptureScreen,
  moveCursor,
  stopStream,
} from "@/features/portal/portal-screen-capture";

it("offers capture only where the browser can share a tab or window", () => {
  expect(canCaptureScreen({ getDisplayMedia: () => Promise.resolve() })).toBe(
    true
  );
  expect(canCaptureScreen({})).toBe(false);
  expect(canCaptureScreen()).toBe(false);
  expect(canCaptureScreen({ getDisplayMedia: "yes" })).toBe(false);
});

it("stops every track so the browser's sharing indicator goes away", () => {
  const stopped: string[] = [];
  stopStream({
    getTracks: () => [
      { stop: () => stopped.push("video") },
      { stop: () => stopped.push("audio") },
    ],
  });
  expect(stopped).toEqual(["video", "audio"]);
});

it("moves the keyboard cursor by a step, a larger step with shift", () => {
  const bounds = { height: 600, width: 800 };
  const from = { x: 100, y: 100 };
  expect(moveCursor(from, "ArrowRight", false, bounds)).toEqual({
    x: 110,
    y: 100,
  });
  expect(moveCursor(from, "ArrowUp", true, bounds)).toEqual({ x: 100, y: 50 });
  expect(moveCursor(from, "ArrowLeft", false, bounds)).toEqual({
    x: 90,
    y: 100,
  });
  expect(moveCursor(from, "ArrowDown", false, bounds)).toEqual({
    x: 100,
    y: 110,
  });
});

it("keeps the cursor on the canvas and ignores other keys", () => {
  const bounds = { height: 600, width: 800 };
  expect(moveCursor({ x: 5, y: 595 }, "ArrowLeft", true, bounds)).toEqual({
    x: 0,
    y: 595,
  });
  expect(moveCursor({ x: 795, y: 595 }, "ArrowDown", true, bounds)).toEqual({
    x: 795,
    y: 600,
  });
  expect(moveCursor({ x: 5, y: 5 }, "a", false, bounds)).toEqual({
    x: 5,
    y: 5,
  });
});

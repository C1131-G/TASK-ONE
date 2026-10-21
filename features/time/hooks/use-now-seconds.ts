"use client";

import { useSyncExternalStore } from "react";

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;

const subscribe = (onTick: () => void): (() => void) => {
  const id = window.setInterval(onTick, TICK_MS);
  return () => window.clearInterval(id);
};

const getSnapshot = (): number => Math.floor(Date.now() / MS_PER_SECOND);

// The server cannot know the viewer's clock, so the first render has no time.
const getServerSnapshot = (): number => 0;

// The current Unix time in whole seconds, refreshed every second, or 0 until
// the page has hydrated.
export const useNowSeconds = (): number =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

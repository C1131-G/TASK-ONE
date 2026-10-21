"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect } from "react";

import { createRealtimeController } from "./realtime-controller";

const EVENTS_URL = "/api/events";
const DEBOUNCE_MS = 300;
const MAX_WAIT_MS = 2000;
const POLL_MS = 60_000;
const RECONNECT_MS = 30_000;

const browserClock = {
  clearTimer: (id: number) => {
    window.clearTimeout(id);
  },
  now: () => Date.now(),
  setTimer: (callback: () => void, delayMs: number) =>
    window.setTimeout(callback, delayMs),
};

// Subscribes this tab to server events and refreshes the current route when
// something changes. Renders nothing.
export const RealtimeRefresh = () => {
  const router = useRouter();

  useEffect(() => {
    const controller = createRealtimeController({
      clock: browserClock,
      createSource: () => new EventSource(EVENTS_URL),
      debounceMs: DEBOUNCE_MS,
      isHidden: () => document.visibilityState === "hidden",
      maxWaitMs: MAX_WAIT_MS,
      onVisibilityChange: (listener) => {
        document.addEventListener("visibilitychange", listener);
        return () => {
          document.removeEventListener("visibilitychange", listener);
        };
      },
      pollMs: POLL_MS,
      reconnectMs: RECONNECT_MS,
      refresh: () => {
        startTransition(() => {
          router.refresh();
        });
      },
    });
    controller.start();
    return () => {
      controller.dispose();
    };
  }, [router]);

  return null;
};

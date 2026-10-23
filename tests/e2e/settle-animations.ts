import type { Page } from "@playwright/test";

const QUIET_MS = 500;
const SETTLE_TIMEOUT_MS = 8000;

interface BusyClock {
  __lastBusyAt?: number;
}

// Waits until no finite animation, such as the workspace reveal fade, has been
// running for a short quiet window. Axe measures contrast from the current
// opacity, so scanning mid-fade reports false contrast failures. Content that
// streams in late starts its own reveal after a first check, so a single look
// is not enough: the page must stay still for the whole window. Looping
// animations (skeleton shimmer) are skipped. A page that never settles is
// scanned anyway after the timeout.
export const settleAnimations = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    (window as unknown as BusyClock).__lastBusyAt = performance.now();
  });
  await page
    .waitForFunction(
      (quietMs) => {
        const clock = window as unknown as BusyClock;
        const now = performance.now();
        const running = document.getAnimations().some(
          (animation) =>
            // A finished animation that keeps its end state stays listed.
            animation.playState !== "finished" &&
            animation.playState !== "idle" &&
            animation.effect?.getComputedTiming().iterations !==
              Number.POSITIVE_INFINITY
        );
        if (running) {
          clock.__lastBusyAt = now;
        }
        return now - (clock.__lastBusyAt ?? now) >= quietMs;
      },
      QUIET_MS,
      { polling: "raf", timeout: SETTLE_TIMEOUT_MS }
    )
    .then(
      () => true,
      () => false
    );
};

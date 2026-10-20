import type { Page } from "@playwright/test";

// Waits for every finite animation, such as the workspace reveal fade, to end.
// Axe measures contrast from the current opacity, so scanning mid-fade reports
// false contrast failures. Looping animations (skeleton shimmer) are skipped.
export const settleAnimations = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const finite = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.effect?.getComputedTiming().iterations !==
          Number.POSITIVE_INFINITY
      );
    await Promise.allSettled(
      finite.map(async (animation) => await animation.finished)
    );
  });
};

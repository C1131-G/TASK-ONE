import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

const openProjectView = async (page: Page, view: string) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=${view}`);
  await page.waitForLoadState("networkidle");
};

const milestone = (page: Page, name: string) =>
  page.getByRole("button", { name: new RegExp(`^${name}, due `, "u") });

// The first calendar date in a label: a milestone's due date, or a bar's start.
const firstDate = (label: string | null): string =>
  /\d{4}-\d{2}-\d{2}/u.exec(label ?? "")?.[0] ?? "";

const dueOf = async (marker: Locator): Promise<string> =>
  firstDate(await marker.getAttribute("aria-label"));

// Fires real touch events through the browser, which turn into touch pointer events.
const touchDrag = async (
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
  holdMs: number
) => {
  const client = await page.context().newCDPSession(page);
  const send = (
    type: "touchEnd" | "touchMove" | "touchStart",
    points: { x: number; y: number }[]
  ) => client.send("Input.dispatchTouchEvent", { touchPoints: points, type });
  await send("touchStart", [from]);
  await page.waitForTimeout(holdMs);
  const steps = 8;
  for (let step = 1; step <= steps; step += 1) {
    // Each step must land before the next, as a finger would.
    // oxlint-disable-next-line no-await-in-loop
    await send("touchMove", [
      {
        x: from.x + ((to.x - from.x) * step) / steps,
        y: from.y + ((to.y - from.y) * step) / steps,
      },
    ]);
  }
  await send("touchEnd", []);
  await client.detach();
};

const centre = async (locator: Locator) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return {
    x: (box?.x ?? 0) + (box?.width ?? 0) / 2,
    y: (box?.y ?? 0) + (box?.height ?? 0) / 2,
  };
};

export { centre, dueOf, firstDate, milestone, openProjectView, touchDrag };

import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

const openPopulatedCalendar = async (page: Page) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=calendar`);
  await page.waitForLoadState("networkidle");
};

// Reads the dates from a timeline bar's label: "Title, 2026-10-03 to 2026-10-05. Arrow keys…".
const barDates = async (page: Page, title: string) => {
  const label =
    (await page
      .getByRole("button", { name: new RegExp(`^${title}, `, "u") })
      .first()
      .getAttribute("aria-label")) ?? "";
  const dates = label.split(". Arrow keys")[0] ?? "";
  const [start = null, due = null] = dates
    .slice(dates.lastIndexOf(", ") + 2)
    .split(" to ");
  return { due, start };
};

// React attaches its props to DOM nodes once hydrated. Until then pointer and key
// events on a bar do nothing, so a test waits for that before it interacts.
const waitForHydratedBar = async (page: Page) => {
  await page.waitForFunction(
    () => {
      const timelineBar = document.querySelector("button.bar");
      return (
        timelineBar !== null &&
        Object.keys(timelineBar).some((key) => key.startsWith("__reactProps"))
      );
    },
    undefined,
    { timeout: 60_000 }
  );
};

// One sign-in serves every test: repeated sign-ins hit the auth rate limit.
test.describe("scheduling", () => {
  test.describe.configure({ mode: "serial" });
  let context: BrowserContext | undefined;
  let page: Page;
  let movedTitle = "";

  test.beforeAll(async ({ browser }) => {
    if (!process.env["E2E_ADMIN_PASSWORD"]) {
      return;
    }
    context = await browser.newContext({ storageState: ADMIN_STATE });
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context?.close();
  });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("a calendar chip dragged to an empty day moves to that day", async () => {
    await openPopulatedCalendar(page);
    const chip = page.locator(".cal-chip[draggable='true']").first();
    await expect(chip).toBeVisible({ timeout: 15_000 });
    const chipName = await chip
      .getByRole("button", { name: /^Open details for/u })
      .getAttribute("aria-label");
    movedTitle = (chipName ?? "").replace(/^Open details for /u, "");
    const movedButton = { exact: true, name: `Open details for ${movedTitle}` };

    // Cells are found by their own "Add task on <day>" label, which does not
    // change when a task moves, so a restore drags back to the right day.
    const sourceCell = page
      .locator(".cday:has(.cal-chip[draggable='true'])")
      .first();
    const sourceAdd = await sourceCell
      .getByRole("button", { name: /^Add task on /u })
      .getAttribute("aria-label");
    const targetCell = page.locator(".cday:not(:has(.cal-chip))").first();
    const targetAdd = await targetCell
      .getByRole("button", { name: /^Add task on /u })
      .getAttribute("aria-label");
    const cellFor = (label: string | null) =>
      page.locator(".cday", {
        has: page.getByRole("button", { exact: true, name: label ?? "" }),
      });

    await chip.dragTo(targetCell);
    await expect(
      cellFor(targetAdd).getByRole("button", movedButton)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      cellFor(sourceAdd).getByRole("button", movedButton)
    ).toHaveCount(0);

    // Put the task back so the fixture keeps its dates for other specs.
    await cellFor(targetAdd)
      .locator(".cal-chip")
      .first()
      .dragTo(cellFor(sourceAdd));
    await expect(
      cellFor(sourceAdd).getByRole("button", movedButton)
    ).toBeVisible({ timeout: 15_000 });
  });

  test("the calendar Move control opens a date form that will not submit the same day", async () => {
    await openPopulatedCalendar(page);
    const moveControl = page
      .getByRole("button", { name: /^Move .+ to another day$/u })
      .first();
    await expect(moveControl).toBeVisible({ timeout: 15_000 });
    await moveControl.click();
    const submit = page.getByRole("button", { exact: true, name: "Move task" });
    await expect(submit).toBeVisible();
    await expect(submit).toBeDisabled();
  });

  test("a timeline click opens the task drawer and does not move the bar", async () => {
    await page.goto("/timeline");
    await page.waitForLoadState("networkidle");
    await waitForHydratedBar(page);
    const timelineBar = page.locator("button.bar").first();
    await expect(timelineBar).toBeVisible({ timeout: 15_000 });
    const before = await timelineBar.getAttribute("aria-label");
    await timelineBar.click();
    await expect(page).toHaveURL(/[?&]task=[0-9a-f-]{36}/u, {
      timeout: 15_000,
    });
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(timelineBar).toHaveAttribute("aria-label", before ?? "");
  });

  test("arrow keys move a timeline bar by a day and the move survives a reload", async () => {
    await page.goto("/timeline");
    await page.waitForLoadState("networkidle");
    await waitForHydratedBar(page);
    const timelineBar = page.locator("button.bar").first();
    await expect(timelineBar).toBeVisible({ timeout: 15_000 });
    const title =
      ((await timelineBar.getAttribute("aria-label")) ?? "").split(", ")[0] ??
      "";
    const original = await barDates(page, title);
    expect(original.due).not.toBeNull();

    await timelineBar.focus();
    await page.keyboard.press("ArrowRight");
    const moved = await barDates(page, title);
    expect(moved.due).not.toBe(original.due);
    await expect(
      page.locator("output").filter({ hasText: "moved to" })
    ).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    const reloaded = await barDates(page, title);
    expect(reloaded.due).toBe(moved.due);

    // Restore the original day with the same key. The press is repeated only while
    // the bar is still off its day, so a press that lands before hydration is safe.
    await expect(async () => {
      const current = await barDates(page, title);
      if (current.due === original.due) {
        return;
      }
      await page
        .locator("button.bar")
        .filter({ hasText: title })
        .first()
        .focus();
      await page.keyboard.press("ArrowLeft");
      const restored = await barDates(page, title);
      expect(restored.due).toBe(original.due);
    }).toPass({ timeout: 30_000 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    const finalDates = await barDates(page, title);
    expect(finalDates.due).toBe(original.due);
  });

  test("dragging a bar's body with the mouse moves it by whole days", async () => {
    await page.goto("/timeline");
    await page.waitForLoadState("networkidle");
    await waitForHydratedBar(page);
    const timelineBar = page.locator("button.bar").first();
    await expect(timelineBar).toBeVisible({ timeout: 15_000 });
    const title =
      ((await timelineBar.getAttribute("aria-label")) ?? "").split(", ")[0] ??
      "";
    const original = await barDates(page, title);
    // page.mouse does not scroll, so bring a bar that is off screen into view.
    await timelineBar.scrollIntoViewIfNeeded();
    const box = await timelineBar.boundingBox();
    expect(box).not.toBeNull();
    if (!box) {
      return;
    }
    const startX = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(startX, y);
    await page.mouse.down();
    // One week-scale day is 32px, so 64px is two days.
    await page.mouse.move(startX + 64, y, { steps: 6 });
    await page.mouse.up();

    await expect(async () => {
      const after = await barDates(page, title);
      expect(after.due).not.toBe(original.due);
    }).toPass({ timeout: 15_000 });
    await page.reload();
    await page.waitForLoadState("networkidle");
    const reloaded = await barDates(page, title);
    expect(reloaded.due).not.toBe(original.due);

    // Move it back the same way; the drag above added two days.
    const back = page.locator("button.bar").filter({ hasText: title }).first();
    await back.scrollIntoViewIfNeeded();
    const backBox = await back.boundingBox();
    if (!backBox) {
      return;
    }
    const fromX = backBox.x + backBox.width / 2;
    const fromY = backBox.y + backBox.height / 2;
    await page.mouse.move(fromX, fromY);
    await page.mouse.down();
    await page.mouse.move(fromX - 64, fromY, { steps: 6 });
    await page.mouse.up();
    await expect(async () => {
      const restored = await barDates(page, title);
      expect(restored.due).toBe(original.due);
    }).toPass({ timeout: 15_000 });
  });
});

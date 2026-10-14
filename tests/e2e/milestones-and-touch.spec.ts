import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";
import {
  centre,
  dueOf,
  firstDate,
  milestone,
  openProjectView,
  touchDrag,
} from "./milestone-touch-helpers";

test.describe("timeline milestones as admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("arrow keys move a milestone a day and the move survives a reload", async ({
    page,
  }) => {
    await openProjectView(page, "timeline");
    const beta = milestone(page, "Beta");
    await expect(beta).toBeVisible();
    const before = await dueOf(beta);
    expect(before).toMatch(/^\d{4}-\d{2}-\d{2}$/u);

    await beta.focus();
    await page.keyboard.press("ArrowRight");
    try {
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        const moved = await dueOf(milestone(page, "Beta"));
        expect(Date.parse(moved) - Date.parse(before)).toBe(86_400_000);
      }).toPass({ timeout: 30_000 });
    } finally {
      await page.goto(page.url());
      await page.waitForLoadState("networkidle");
      const current = milestone(page, "Beta");
      if ((await dueOf(current)) !== before) {
        await current.focus();
        await page.keyboard.press("ArrowLeft");
        await expect(page.getByText(`Beta moved to ${before}.`)).toBeAttached({
          timeout: 30_000,
        });
        await expect(async () => {
          await page.reload();
          await page.waitForLoadState("networkidle");
          expect(await dueOf(milestone(page, "Beta"))).toBe(before);
        }).toPass({ timeout: 30_000 });
      }
    }
  });

  test("dragging a milestone with the mouse moves it by whole days", async ({
    page,
  }) => {
    await openProjectView(page, "timeline");
    const launch = milestone(page, "Launch");
    await expect(launch).toBeVisible();
    const before = await dueOf(launch);
    const point = await centre(launch);

    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.mouse.move(point.x + 40, point.y, { steps: 6 });
    await page.mouse.move(point.x + 64, point.y, { steps: 6 });
    await page.mouse.up();
    try {
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        const moved = await dueOf(milestone(page, "Launch"));
        // 64px is two days at the week scale's 32px a day.
        expect(Date.parse(moved) - Date.parse(before)).toBe(2 * 86_400_000);
      }).toPass({ timeout: 30_000 });
    } finally {
      const current = milestone(page, "Launch");
      await current.focus();
      if ((await dueOf(current)) !== before) {
        await page.keyboard.press("ArrowLeft");
        await page.keyboard.press("ArrowLeft");
        // Reloading now would cancel the second save, so wait for it to finish.
        await expect(page.getByText(`Launch moved to ${before}.`)).toBeAttached(
          { timeout: 30_000 }
        );
      }
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        expect(await dueOf(milestone(page, "Launch"))).toBe(before);
      }).toPass({ timeout: 30_000 });
    }
  });
});

test.describe("timeline milestones as employee", () => {
  test.use({ storageState: EMPLOYEE_STATE });

  test("an employee sees the milestones but cannot move them", async ({
    page,
  }) => {
    test.skip(
      !process.env["E2E_EMPLOYEE_PASSWORD"],
      "E2E_EMPLOYEE_PASSWORD is not set"
    );
    await openProjectView(page, "timeline");
    await expect(page.getByText(/^Beta, due /u).first()).toBeAttached();
    await expect(milestone(page, "Beta")).toHaveCount(0);
  });
});

test.describe("touch dragging as admin", () => {
  test.use({ hasTouch: true, storageState: ADMIN_STATE });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("a finger drag moves a timeline bar by whole days", async ({ page }) => {
    await openProjectView(page, "timeline");
    const taskBar = page.getByRole("button", { name: /^Fixture task 5, /u });
    await expect(taskBar).toBeVisible();
    const before = firstDate(await taskBar.getAttribute("aria-label"));
    expect(before).not.toBe("");

    const point = await centre(taskBar);
    await touchDrag(page, point, { x: point.x + 64, y: point.y }, 50);
    try {
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        const moved = firstDate(
          await page
            .getByRole("button", { name: /^Fixture task 5, /u })
            .getAttribute("aria-label")
        );
        expect(Date.parse(moved) - Date.parse(before)).toBe(2 * 86_400_000);
      }).toPass({ timeout: 30_000 });
    } finally {
      const current = page.getByRole("button", { name: /^Fixture task 5, /u });
      await current.focus();
      await page.keyboard.press("ArrowLeft");
      await page.keyboard.press("ArrowLeft");
      // Reloading now would cancel the second save, so wait for it to finish.
      await expect(
        page.getByText(`Fixture task 5 moved to ${before}.`)
      ).toBeAttached({ timeout: 30_000 });
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        expect(
          firstDate(
            await page
              .getByRole("button", { name: /^Fixture task 5, /u })
              .getAttribute("aria-label")
          )
        ).toBe(before);
      }).toPass({ timeout: 30_000 });
    }
  });

  test("holding a calendar chip and dragging it onto a day moves the task", async ({
    page,
  }) => {
    await openProjectView(page, "calendar");
    const chip = page
      .locator(".cal-chip", {
        has: page.getByRole("button", {
          name: "Open details for Fixture task 5",
        }),
      })
      .first();
    await expect(chip).toBeVisible();
    const sourceDay = chip.locator("xpath=ancestor::*[@data-day][1]");
    const from = (await sourceDay.getAttribute("data-day")) ?? "";
    expect(from).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
    const target = new Date(Date.parse(`${from}T00:00:00Z`) + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const targetCell = page.locator(`[data-day="${target}"]`);
    await expect(targetCell).toBeVisible();

    await targetCell.scrollIntoViewIfNeeded();
    const start = await centre(chip);
    const end = await centre(targetCell);
    await touchDrag(page, start, end, 600);
    try {
      await expect(
        page.locator(`[data-day="${target}"] .cal-chip`, {
          hasText: "Fixture task 5",
        })
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      const moved = page
        .locator(`[data-day="${target}"] .cal-chip`, {
          hasText: "Fixture task 5",
        })
        .first();
      if ((await moved.count()) > 0) {
        const back = await centre(page.locator(`[data-day="${from}"]`));
        await touchDrag(page, await centre(moved), back, 600);
        await expect(
          page.locator(`[data-day="${from}"] .cal-chip`, {
            hasText: "Fixture task 5",
          })
        ).toBeVisible({ timeout: 30_000 });
      }
    }
  });

  test("a quick swipe on a calendar chip does not move it", async ({
    page,
  }) => {
    await openProjectView(page, "calendar");
    const chip = page
      .locator(".cal-chip", {
        has: page.getByRole("button", {
          name: "Open details for Fixture task 5",
        }),
      })
      .first();
    await expect(chip).toBeVisible();
    const from =
      (await chip
        .locator("xpath=ancestor::*[@data-day][1]")
        .getAttribute("data-day")) ?? "";
    const target = new Date(Date.parse(`${from}T00:00:00Z`) + 3 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const targetCell = page.locator(`[data-day="${target}"]`);
    await targetCell.scrollIntoViewIfNeeded();
    const start = await centre(chip);
    const end = await centre(targetCell);
    // No hold: the finger moves at once, which is a scroll, not a drag.
    await touchDrag(page, start, end, 0);
    await page.waitForTimeout(1500);
    await expect(
      page.locator(`[data-day="${from}"] .cal-chip`, {
        hasText: "Fixture task 5",
      })
    ).toBeVisible();
  });
});

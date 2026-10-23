import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

// The topbar link reads "Notifications, 42 unread", or "Open notifications"
// once nothing is unread.
const unreadCount = async (page: Page): Promise<number> => {
  const label = await page
    .getByRole("link", {
      name: /^(?:Notifications, \d+ unread|Open notifications)$/u,
    })
    .first()
    .getAttribute("aria-label");
  return Number((label ?? "").replaceAll(/\D/gu, "") || "0");
};

test.describe("inbox and notifications as employee", () => {
  test.use({ storageState: EMPLOYEE_STATE });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_EMPLOYEE_PASSWORD"],
      "E2E_EMPLOYEE_PASSWORD is not set"
    );
  });

  test("inbox tabs filter the notifications by kind", async ({ page }) => {
    await page.goto("/inbox");
    await page.waitForLoadState("networkidle");
    const assigned = page.getByText("assigned you a task").first();
    const commented = page.getByText("commented on a task").first();
    await expect(assigned).toBeVisible();

    await page.getByRole("tab", { name: /^Comments/u }).click();
    await expect(commented).toBeVisible();
    await expect(page.getByText("assigned you a task")).toHaveCount(0);

    await page.getByRole("tab", { name: /^Assignments/u }).click();
    await expect(assigned).toBeVisible();
    await expect(page.getByText("commented on a task")).toHaveCount(0);

    await page.getByRole("tab", { name: /^Mentions/u }).click();
    await expect(page.getByText("mentioned you").first()).toBeVisible();
    await expect(page.getByText("assigned you a task")).toHaveCount(0);
  });

  test("marking one notification as read lowers the unread count", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    const before = await unreadCount(page);
    test.skip(before === 0, "No unread notifications are left");

    await page
      .getByRole("button", { name: /^Mark as read:/u })
      .first()
      .click();
    await expect(async () => {
      expect(await unreadCount(page)).toBe(before - 1);
    }).toPass({ timeout: 20_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(await unreadCount(page)).toBe(before - 1);
  });

  test("the Unread tab lists only notifications that can still be marked read", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    test.skip((await unreadCount(page)) === 0, "No unread notifications");
    await page.getByRole("tab", { name: "Unread" }).click();
    const rows = page.locator("a", { hasText: /UI Admin/u });
    const marks = page.getByRole("button", { name: /^Mark as read:/u });
    await expect(marks.first()).toBeVisible();
    expect(await marks.count()).toBe(await rows.count());
  });
});

test.describe("activity and archive as admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("activity tabs switch and the person filter lists employees", async ({
    page,
  }) => {
    await page.goto("/activity");
    await page.waitForLoadState("networkidle");
    // The streamed skeleton repeats the tabs but keeps its filters inert.
    const filters = page.locator(".activity-filters:not([inert])");
    await expect(filters).toBeVisible();
    // Clicks must run one after another, since each tab replaces the list.
    const selectTab = async (name: string) => {
      const tab = filters.getByRole("tab", { name });
      // A click before hydration does nothing, so click again until it lands.
      await expect(async () => {
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true", {
          timeout: 1500,
        });
      }).toPass();
    };
    await selectTab("Status changes");
    await selectTab("Comments");
    await selectTab("Projects");
    await selectTab("All");
    await page.getByRole("button", { name: /Filter by person/u }).click();
    await expect(page.getByRole("option", { name: /UI Admin/u })).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("the archive lists the seeded items; an archived task joins it and can be restored", async ({
    page,
  }) => {
    const row = (title: string) =>
      page.locator("article.archive-row", { hasText: title });
    const tasksTab = page.getByRole("tab", { name: /^Tasks \d+/u });
    const countOf = async () =>
      Number(((await tasksTab.textContent()) ?? "").replaceAll(/\D/gu, ""));

    await page.goto("/archive");
    await page.waitForLoadState("networkidle");
    const baseline = await countOf();
    // The fixtures archive one task and one project.
    expect(baseline).toBeGreaterThanOrEqual(1);
    await expect(row("Archived fixture task")).toBeVisible();
    await page.getByRole("tab", { name: /^Projects/u }).click();
    await expect(row("UI Fixture Archived")).toBeVisible();

    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");
    const more = page
      .getByRole("button", { name: /^More actions for Fixture task/u })
      .first();
    const label = (await more.getAttribute("aria-label")) ?? "";
    const title = label.replace("More actions for ", "");
    expect(title).toMatch(/^Fixture task/u);
    await more.click();
    await page.getByRole("menuitem", { name: "Archive task" }).click();

    try {
      await expect(async () => {
        await page.goto("/archive");
        await page.waitForLoadState("networkidle");
        await expect(row(title)).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 30_000 });
      expect(await countOf()).toBe(baseline + 1);
    } finally {
      await page.goto("/archive");
      await page.waitForLoadState("networkidle");
      const restore = row(title).getByRole("button", { name: "Restore" });
      if ((await restore.count()) > 0) {
        await restore.click();
        await expect(row(title)).toHaveCount(0, { timeout: 20_000 });
      }
    }
    await page.reload();
    await page.waitForLoadState("networkidle");
    expect(await countOf()).toBe(baseline);
  });
});

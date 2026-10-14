import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

const TASK_PARAM = /[?&]task=[0-9a-f-]{36}/u;

test.use({ storageState: ADMIN_STATE });

test.beforeEach(() => {
  test.skip(
    !process.env["E2E_ADMIN_PASSWORD"],
    "E2E_ADMIN_PASSWORD is not set"
  );
});

// The task drawer is the only dialog with a Details section. Its Title field is
// not used here: a long title changes the field's accessible name.
const drawerDetails = (page: Page) =>
  page.getByRole("dialog").getByRole("heading", { name: "Details" });

const expectDrawerOpen = async (page: Page) => {
  await expect(page).toHaveURL(TASK_PARAM);
  await expect(drawerDetails(page)).toBeVisible({ timeout: 15_000 });
};

test.describe("task drawer links", () => {
  test("/tasks opens the drawer from a row and reopens it after a reload", async ({
    page,
  }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");
    await expect(async () => {
      await page
        .getByRole("button", { name: /^Open details for/u })
        .first()
        .click();
      await expect(page).toHaveURL(TASK_PARAM, { timeout: 2000 });
    }).toPass();
    await expect(drawerDetails(page)).toBeVisible({ timeout: 15_000 });

    const taskId = new URL(page.url()).searchParams.get("task");
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expectDrawerOpen(page);
    expect(new URL(page.url()).searchParams.get("task")).toBe(taskId);
  });

  test("/my-tasks opens the drawer from a row when tasks are assigned", async ({
    page,
  }) => {
    await page.goto("/my-tasks");
    await page.waitForLoadState("networkidle");
    const rows = page.getByRole("button", { name: /^Open details for/u });
    test.skip((await rows.count()) === 0, "No tasks are assigned to the admin");
    await expect(async () => {
      await rows.first().click();
      await expect(page).toHaveURL(TASK_PARAM, { timeout: 2000 });
    }).toPass();
    await expect(drawerDetails(page)).toBeVisible({ timeout: 15_000 });
  });

  test("a search result opens its task in the project drawer", async ({
    page,
  }) => {
    await page.goto("/search?q=task");
    await page.getByRole("button", { exact: true, name: "Search" }).click();
    const result = page.locator('a[href*="?task="]').first();
    await expect(result).toBeVisible({ timeout: 15_000 });
    await result.click();
    await expect(page).toHaveURL(/\/projects\/[^/?]+\?.*task=/u, {
      timeout: 30_000,
    });
    await expectDrawerOpen(page);
  });

  test("a favorite task title opens its task in the project drawer", async ({
    page,
  }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");
    const add = page.getByRole("button", {
      exact: true,
      name: "Add to favorites",
    });
    const remove = page.getByRole("button", {
      exact: true,
      name: "Remove from favorites",
    });
    test.skip((await add.count()) === 0, "No task favorite control on /tasks");
    // A click before hydration does nothing, so retry until the star turns on.
    await expect(async () => {
      if ((await remove.count()) === 0) {
        await add.first().click();
      }
      await expect(remove.first()).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 30_000 });

    try {
      await page.goto("/favorites");
      const title = page.locator("a.favorite-task-title").first();
      await expect(title).toBeVisible({ timeout: 15_000 });
      await title.click();
      await expectDrawerOpen(page);
    } finally {
      // Leave the favorites as they were found.
      await page.goto("/tasks");
      await page.waitForLoadState("networkidle");
      await expect(async () => {
        if ((await remove.count()) > 0) {
          await remove.first().click();
        }
        await expect(remove).toHaveCount(0, { timeout: 3000 });
      }).toPass({ timeout: 30_000 });
    }
  });
});

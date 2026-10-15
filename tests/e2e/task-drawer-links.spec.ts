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
  await expect(page).toHaveURL(TASK_PARAM, { timeout: 30_000 });
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

  test("opening a task keeps the active task filter in the URL", async ({
    page,
  }) => {
    await page.goto("/tasks?status=open");
    await page.waitForLoadState("networkidle");
    const opener = page.getByRole("button", { name: /^Open details for/u });
    test.skip((await opener.count()) === 0, "No tasks are available");

    await opener.first().click();
    await expectDrawerOpen(page);
    await expect(page).toHaveURL(/\/tasks\?.*status=open/u);
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
    await page.goto("/tasks?view=list");
    await page.waitForLoadState("networkidle");
    const targetRow = page.locator(".trow").first();
    test.skip((await targetRow.count()) === 0, "No tasks are available");
    const taskLink = targetRow.locator("a.trunc");
    const taskText = await taskLink.textContent();
    const taskTitle = taskText?.trim() ?? "";
    const taskHref = await taskLink.getAttribute("href");
    if (!taskHref) {
      throw new Error("Task row title is missing its project link");
    }
    const projectPath = new URL(taskHref, page.url()).pathname;
    const add = targetRow.getByRole("button", {
      exact: true,
      name: "Add to favorites",
    });
    const remove = targetRow.getByRole("button", {
      exact: true,
      name: "Remove from favorites",
    });
    const wasFavorite = (await remove.count()) > 0;

    test.skip(
      !wasFavorite && (await add.count()) === 0,
      "The first task cannot be favorited"
    );
    if (!wasFavorite) {
      // A click before hydration does nothing, so retry until this task's star turns on.
      await expect(async () => {
        await add.click();
        await expect(remove).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 30_000 });
    }

    try {
      await page.goto("/favorites");
      const title = page
        .locator(`a.favorite-task-title[href^="${projectPath}?task="]`)
        .filter({ hasText: taskTitle })
        .first();
      await expect(title).toBeVisible({ timeout: 15_000 });
      await title.click();
      await expectDrawerOpen(page);
    } finally {
      // Leave this task's favorite state as it was found.
      if (!wasFavorite) {
        await page.goto("/tasks?view=list");
        await page.waitForLoadState("networkidle");
        const originalRow = page
          .locator(`.trow:has(a.trunc[href^="${projectPath}?view="])`)
          .filter({ hasText: taskTitle })
          .first();
        const originalRemove = originalRow.getByRole("button", {
          exact: true,
          name: "Remove from favorites",
        });
        await expect(originalRemove).toBeVisible({ timeout: 15_000 });
        await originalRemove.click();
        await expect(
          originalRow.getByRole("button", {
            exact: true,
            name: "Add to favorites",
          })
        ).toBeVisible({ timeout: 15_000 });
      }
    }
  });
});

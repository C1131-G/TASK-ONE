import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

const pickStatus = async (page: Page, label: string) => {
  await page.getByRole("combobox", { name: "Filter by status" }).click();
  await page.getByRole("option", { name: label }).click();
};

// One sign-in serves every test: repeated sign-ins hit the auth rate limit.
test.describe("workspace task pages", () => {
  test.describe.configure({ mode: "serial" });
  let context: BrowserContext | undefined;
  let page: Page;

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

  test("filters stay in the URL across view tabs and reloads on /tasks", async () => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await pickStatus(page, "To Do");
      await expect(page).toHaveURL(/[?&]status=todo(?:&|$)/u, {
        timeout: 2000,
      });
    }).toPass();

    await page.getByRole("button", { name: "Board" }).click();
    await expect(page).toHaveURL(/[?&]view=board(?:&|$)/u);
    await expect(page).toHaveURL(/[?&]status=todo(?:&|$)/u);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/[?&]status=todo(?:&|$)/u);
    await expect(page.getByRole("button", { name: "Board" })).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("my tasks tabs keep the active filters", async () => {
    await page.goto("/my-tasks");
    await page.waitForLoadState("networkidle");

    await expect(async () => {
      await pickStatus(page, "Done");
      await expect(page).toHaveURL(/[?&]status=done(?:&|$)/u, {
        timeout: 2000,
      });
    }).toPass();

    const viewNav = page.getByRole("navigation", { name: "My Tasks view" });
    await viewNav.getByRole("link", { name: "Calendar" }).click();
    // The calendar view is a server render, so allow for a cold compile.
    await expect(page).toHaveURL(/[?&]view=calendar(?:&|$)/u, {
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/[?&]status=done(?:&|$)/u);

    const listLink = viewNav.getByRole("link", { name: "List" });
    await listLink.click();
    await expect(listLink).toHaveAttribute("aria-current", "page", {
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/[?&]status=done(?:&|$)/u);
    await expect(page).not.toHaveURL(/view=calendar/u);
  });

  test("table columns hide, sort and resize, and the width survives a reload", async () => {
    await page.goto("/tasks?view=table");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Project" }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/[?&]hidden=project(?:&|$)/u);
    await expect(
      page.getByRole("columnheader", { name: "Project" })
    ).toHaveCount(0);

    await expect(async () => {
      await page.getByRole("button", { name: "Priority" }).click();
      await expect(page).toHaveURL(/[?&]sort=priority(?:&|$)/u, {
        timeout: 2000,
      });
    }).toPass();

    // Widths persist between runs, so resize toward the middle of the range.
    const dueHeader = page.locator('th[data-column="due"]');
    const startWidth = await dueHeader.evaluate((element) => {
      if (!(element instanceof HTMLElement)) {
        return 0;
      }
      return Number(element.style.width.replace("px", ""));
    });
    const dueResize = page.getByRole("separator", {
      name: "Resize Due column",
    });
    await dueResize.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    // Five 8px steps; the save runs after resizing settles.
    const expectedWidth = startWidth + 40;
    await expect(dueHeader).toHaveAttribute(
      "style",
      new RegExp(`width:\\s*${expectedWidth}px`, "u")
    );
    await page.waitForTimeout(2000);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("columnheader", { name: "Project" })
    ).toHaveCount(0);
    await expect(page.locator('th[data-column="due"]')).toHaveAttribute(
      "style",
      new RegExp(`width:\\s*${expectedWidth}px`, "u")
    );
  });

  test("selecting tasks updates the shared selection count", async () => {
    await page.goto("/tasks?view=table");
    await page.waitForLoadState("networkidle");

    await expect(async () => {
      // The header checkbox is also named "Select …", so skip it.
      await page
        .getByRole("checkbox", { name: /^Select (?!all tasks)/u })
        .first()
        .click();
      await expect(page.getByText("1 selected", { exact: true })).toBeVisible({
        timeout: 2000,
      });
    }).toPass();
  });
});

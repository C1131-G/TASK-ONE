import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

const openPopulatedTable = async (page: Page) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=table`);
  await page.waitForLoadState("networkidle");
};

const titleField = (page: Page) =>
  page.getByRole("dialog").getByLabel("Title", { exact: true });

// Every test opens its own starting state, so each one runs alone as well.
const openFirstTaskDrawer = async (page: Page) => {
  await openPopulatedTable(page);
  await expect(async () => {
    await page
      .getByRole("button", { name: /^Open details for/u })
      .first()
      .click();
    await expect(page).toHaveURL(/[?&]task=[0-9a-f-]{36}/u, {
      timeout: 2000,
    });
  }).toPass();
  await expect(titleField(page)).not.toHaveValue("", { timeout: 15_000 });
};

// One sign-in serves every test: repeated sign-ins hit the auth rate limit.
test.describe("task drawer", () => {
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

  test("a row opens the drawer with ?task= and survives a reload", async () => {
    await openFirstTaskDrawer(page);
    const taskId = new URL(page.url()).searchParams.get("task");
    expect(taskId).toMatch(/^[0-9a-f-]{36}$/u);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(titleField(page)).not.toHaveValue("", { timeout: 15_000 });
    await expect(new URL(page.url()).searchParams.get("task")).toBe(taskId);
  });

  test("closing with unsaved edits asks first and keeps the draft until discarded", async () => {
    await openFirstTaskDrawer(page);
    const drawer = page.getByRole("dialog");
    const estimate = drawer.getByLabel("Estimate");
    await estimate.fill("unsaved");
    await page.keyboard.press("Escape");

    const discard = page.getByRole("heading", {
      name: "Discard unsaved changes?",
    });
    await expect(discard).toBeVisible();
    await page.getByRole("button", { name: "Keep editing" }).click();
    await expect(drawer).toBeVisible();
    await expect(estimate).toHaveValue("unsaved");

    await page.keyboard.press("Escape");
    await expect(discard).toBeVisible();
    await page.getByRole("button", { name: "Discard changes" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).not.toHaveURL(/[?&]task=/u);
  });

  test("saving details persists the estimate on the same task", async () => {
    await openFirstTaskDrawer(page);
    const savedTitle = await titleField(page).inputValue();
    const drawer = page.getByRole("dialog");
    const estimate = drawer.getByLabel("Estimate");
    await expect(estimate).toBeEnabled({ timeout: 15_000 });
    // A unique value keeps the form dirty even when an earlier run saved one.
    const value = `${Date.now() % 100_000}h`;
    await estimate.fill(value);
    await drawer.getByRole("button", { name: "Save details" }).click();
    await expect(
      drawer.getByRole("button", { name: "Save details" })
    ).toBeDisabled({ timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState("networkidle");
    // The reopened drawer must be the task that was saved, not a neighbour.
    await expect(titleField(page)).toHaveValue(savedTitle, {
      timeout: 15_000,
    });
    await expect(page.getByRole("dialog").getByLabel("Estimate")).toHaveValue(
      value,
      { timeout: 15_000 }
    );
  });

  test("typing @ offers employees and inserts a mention token", async () => {
    await openFirstTaskDrawer(page);
    const drawer = page.getByRole("dialog");
    const comment = drawer.getByLabel("Add a comment");
    await comment.fill("Looping in @");
    await expect(drawer.getByRole("listbox")).toBeVisible();
    await drawer.getByRole("option").first().click();
    await expect(comment).toHaveValue(/@\[[0-9a-f-]{36}\] $/u);
    await comment.fill("");
  });

  test("a removed comment can be restored from the global undo stack", async () => {
    await openFirstTaskDrawer(page);
    const drawer = page.getByRole("dialog");
    const comment = drawer.getByLabel("Add a comment");
    const text = `e2e note ${Date.now()}`;
    await comment.fill(text);
    await drawer.getByRole("button", { exact: true, name: "Comment" }).click();
    await expect(drawer.getByText(text)).toBeVisible({ timeout: 15_000 });

    await drawer
      .locator("article.comment", { hasText: text })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(drawer.getByText(text)).toHaveCount(0);

    // The sheet is modal, so the undo stack is used once it is closed.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const undoStack = page.getByRole("region", { name: "Recent actions" });
    await expect(undoStack.getByText("Comment removed")).toBeVisible();
    await undoStack.getByRole("button", { name: "Undo" }).first().click();
    await expect(undoStack.getByText("Comment removed")).toHaveCount(0);

    await openFirstTaskDrawer(page);
    await expect(page.getByRole("dialog").getByText(text)).toBeVisible({
      timeout: 15_000,
    });
  });
});

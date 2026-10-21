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
  await expect(
    page.getByRole("dialog").getByLabel("Title", { exact: true })
  ).not.toHaveValue("", { timeout: 15_000 });
};

// Two tabs of the same account stand in for two people: a change made in one
// reaches the other through the server event stream, without a reload.
test.describe("Live updates", () => {
  test.describe.configure({ mode: "serial" });
  let contexts: BrowserContext[] = [];
  let watcher: Page;
  let author: Page;

  test.beforeAll(async ({ browser }) => {
    if (!process.env["E2E_ADMIN_PASSWORD"]) {
      return;
    }
    contexts = [
      await browser.newContext({ storageState: ADMIN_STATE }),
      await browser.newContext({ storageState: ADMIN_STATE }),
    ];
    const [first, second] = contexts;
    if (!first || !second) {
      throw new Error("The browser contexts could not be created.");
    }
    watcher = await first.newPage();
    author = await second.newPage();
  });

  test.afterAll(async () => {
    await Promise.all(contexts.map((context) => context.close()));
  });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("the workspace opens one event stream", async () => {
    const stream = watcher.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/events"
    );
    await watcher.goto("/overview");
    const response = await stream;
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/event-stream");
  });

  test("a comment posted in one tab appears in the other without a reload", async () => {
    await openFirstTaskDrawer(watcher);
    const taskUrl = watcher.url();
    await author.goto(taskUrl);
    await author.waitForLoadState("networkidle");
    const drawer = author.getByRole("dialog");
    await expect(drawer.getByLabel("Add a comment")).toBeVisible({
      timeout: 15_000,
    });

    const text = `live note ${Date.now()}`;
    await drawer.getByLabel("Add a comment").fill(text);
    await drawer.getByRole("button", { exact: true, name: "Comment" }).click();
    await expect(drawer.getByText(text)).toBeVisible({ timeout: 15_000 });

    await expect(watcher.getByRole("dialog").getByText(text)).toBeVisible({
      timeout: 15_000,
    });

    // Remove the note so repeated runs do not pile up comments.
    await drawer
      .locator("article.comment", { hasText: text })
      .getByRole("button", { name: "Remove" })
      .click();
    await expect(watcher.getByRole("dialog").getByText(text)).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("an anonymous visitor gets no event stream", async ({ browser }) => {
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await context.request.get("/api/events");
      expect(response.status()).toBe(401);
    } finally {
      await context.close();
    }
  });
});

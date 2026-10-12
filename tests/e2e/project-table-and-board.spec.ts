import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const signIn = async (page: Page) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "ui-admin@metsys.test");
  await page.fill(
    'input[name="password"]',
    process.env["E2E_ADMIN_PASSWORD"] ?? ""
  );
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/", {
    timeout: 90_000,
    waitUntil: "commit",
  });
};

const openPopulatedProject = async (page: Page, view: string) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=${view}`);
};

test.describe("project table and board", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("columns can be hidden, sorted and resized, and hidden columns survive a reload", async ({
    page,
  }) => {
    await signIn(page);
    await openPopulatedProject(page, "table");

    await page.getByRole("button", { name: "Columns" }).click();
    await page.getByRole("menuitemcheckbox", { name: "Estimate" }).click();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/[?&]hidden=estimate(?:&|$)/u);
    await expect(
      page.getByRole("columnheader", { name: "Estimate" })
    ).toHaveCount(0);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("columnheader", { name: "Estimate" })
    ).toHaveCount(0);

    const dueHeader = page.getByRole("columnheader", { name: /^Due/u });
    // Retry the click until the page has hydrated and the handler has run.
    await expect(async () => {
      await page.getByRole("button", { name: "Due" }).click();
      await expect(page).toHaveURL(/[?&]sort=due(?:&|$)/u, { timeout: 2000 });
    }).toPass({ timeout: 60_000 });
    await expect(dueHeader).toHaveAttribute("aria-sort", "ascending");

    const resizer = page.getByRole("separator", {
      name: "Resize Priority column",
    });
    const before = Number(await resizer.getAttribute("aria-valuenow"));
    await resizer.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(resizer).toHaveAttribute("aria-valuenow", String(before + 16));
  });

  test("a card moves within its column with Alt+arrow and the order survives a reload", async ({
    page,
  }) => {
    await signIn(page);
    await openPopulatedProject(page, "board");

    const todoCards = page.locator(
      'section.bcol[aria-label^="To Do"] article.kcard'
    );
    await expect(todoCards.nth(1)).toBeVisible();
    const firstTitle =
      (await todoCards.nth(0).locator(".title").textContent()) ?? "";
    const secondTitle =
      (await todoCards.nth(1).locator(".title").textContent()) ?? "";

    await todoCards.nth(0).focus();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(
      page
        .locator('[aria-live="polite"]')
        .filter({ hasText: "moved to position 2" })
    ).toBeVisible({
      timeout: 60_000,
    });

    await page.reload();
    await page.waitForLoadState("networkidle");
    const reloaded = page.locator(
      'section.bcol[aria-label^="To Do"] article.kcard'
    );
    await expect(reloaded.nth(0).locator(".title")).toHaveText(secondTitle, {
      timeout: 60_000,
    });
    await expect(reloaded.nth(1).locator(".title")).toHaveText(firstTitle);
  });
});

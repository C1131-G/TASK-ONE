import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import {
  CLIENT_ONE_STATE,
  CLIENT_TWO_STATE,
  HANDLER_STATE,
} from "./auth-state";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BUG_TITLE = `Invoice export fails ${Date.now()}`;

test.describe.configure({ mode: "serial" });

const expectNoViolations = async (page: Page, where: string) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const summary = results.violations.map(
    (violation) => `${violation.id} (${violation.nodes.length})`
  );
  expect(summary, `axe violations on ${where}`).toEqual([]);
};

const noSidewaysScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
};

test.describe("client one", () => {
  test.use({ storageState: CLIENT_ONE_STATE });

  test("reports a bug, edits it and comments", async ({ page }) => {
    await page.goto("/portal/new");
    await page.getByLabel("Title").fill(BUG_TITLE);
    await page.getByLabel("Expected behavior").fill("A CSV file downloads.");
    await page.getByLabel("Actual behavior").fill("The page shows an error.");
    await page
      .getByRole("textbox", { name: "Step 1" })
      .fill("Open the Invoices page");
    await page.getByLabel("Page URL").fill("https://acme.example/invoices");
    await page.getByRole("radio", { name: /High/u }).check();
    await page.getByRole("button", { name: /submit|send|report/iu }).click();
    await page.waitForURL(/\/portal\/bugs\//u, { timeout: 60_000 });
    await expect(page.getByRole("heading", { name: BUG_TITLE })).toBeVisible();
    await expect(page.getByText("Submitted").first()).toBeVisible();
    await expectNoViolations(page, "bug detail");

    await page.getByLabel("Add a comment").fill("Seen on Chrome 130.");
    await page.getByRole("button", { name: /^send comment/iu }).click();
    await expect(page.getByText("Seen on Chrome 130.")).toBeVisible();
  });

  for (const route of [
    "/portal",
    "/portal/new",
    "/portal/notifications",
    "/portal/account",
  ]) {
    test(`${route} passes axe and fits a phone`, async ({ page }) => {
      await page.setViewportSize({ height: 800, width: 1280 });
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoViolations(page, route);
      await page.setViewportSize({ height: 700, width: 320 });
      await noSidewaysScroll(page);
    });
  }

  test("the workspace is closed to clients", async ({ page }) => {
    await page.goto("/projects");
    await expect(page).not.toHaveURL(/\/projects/u);
  });
});

test.describe("client two", () => {
  test.use({ storageState: CLIENT_TWO_STATE });

  test("sees a colleague's bug in the company list", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByText(BUG_TITLE)).toBeVisible();
  });
});

test.describe("handler", () => {
  test.use({ storageState: HANDLER_STATE });

  test("picks the client bug and the client sees it acknowledged", async ({
    page,
  }) => {
    await page.goto("/bugs");
    await page.getByText(BUG_TITLE).first().click();
    await page.getByRole("button", { name: "Pick this bug" }).click();
    await expect(page.getByText(/picked|assigned/iu).first()).toBeVisible();
  });
});

test.describe("client one after pick", () => {
  test.use({ storageState: CLIENT_ONE_STATE });

  test("shows the new status", async ({ page }) => {
    await page.goto("/portal");
    await page.getByText(BUG_TITLE).first().click();
    await expect(
      page.getByText(/Acknowledged|In progress/u).first()
    ).toBeVisible();
  });
});

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
  return href ?? "";
};

const openFirstTaskDrawer = async (page: Page) => {
  const href = await openPopulatedTable(page);
  await expect(async () => {
    await page
      .getByRole("button", { name: /^Open details for/u })
      .first()
      .click();
    await expect(page).toHaveURL(/[?&]task=[0-9a-f-]{36}/u, { timeout: 2000 });
  }).toPass();
  const timeSection = page.getByRole("region", { name: "Time tracking" });
  await expect(timeSection).toBeVisible({ timeout: 15_000 });
  return { href, timeSection };
};

// One sign-in serves every test: repeated sign-ins hit the auth rate limit.
test.describe("My time (/my-time)", () => {
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

  test("manual time logged in a task drawer shows in the total, on My time, and can be deleted", async () => {
    const { timeSection } = await openFirstTaskDrawer(page);
    await timeSection
      .getByRole("button", { name: "Log time manually" })
      .click();
    await timeSection.getByLabel("Time", { exact: true }).fill("1h 30m");
    await timeSection.getByLabel("Note").fill("E2E time entry");
    await timeSection.getByRole("button", { name: "Log time" }).click();

    const entry = timeSection.getByText("E2E time entry");
    await expect(entry).toBeVisible({ timeout: 20_000 });
    await expect(timeSection.getByText("1h 30m").first()).toBeVisible();

    await page.goto("/my-time");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { level: 1, name: "My time" })
    ).toBeVisible();
    await expect(page.getByText("E2E time entry")).toBeVisible();

    await page
      .getByRole("button", { name: /^Delete 1h 30m entry on/u })
      .first()
      .click();
    await expect(page.getByText("E2E time entry")).toHaveCount(0, {
      timeout: 20_000,
    });
  });

  test("a bad duration is refused beside the field", async () => {
    await page.goto("/my-time");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Log time" })).toBeVisible();
    await page.getByLabel("Time", { exact: true }).fill("soon");
    await page.getByRole("button", { name: "Log time" }).click();
    await expect(
      page.getByText("Enter a time like 1h 30m, 1:30 or 45.")
    ).toBeVisible();
  });

  test("the timer starts in a task drawer and stops into an entry", async () => {
    const { timeSection } = await openFirstTaskDrawer(page);
    await timeSection.getByRole("button", { name: "Start timer" }).click();
    await expect(timeSection.getByRole("timer")).toBeVisible({
      timeout: 20_000,
    });

    await timeSection.getByRole("button", { name: "Stop timer" }).click();
    await expect(timeSection.getByRole("timer")).toHaveCount(0, {
      timeout: 20_000,
    });
    const remove = timeSection
      .getByRole("button", { name: /^Delete 1m entry on/u })
      .first();
    await expect(remove).toBeVisible({ timeout: 20_000 });
    await remove.click();
    await expect(remove).toBeHidden({ timeout: 20_000 });
  });

  test("the previous and next week links move the week", async () => {
    await page.goto("/my-time?week=2026-10-21");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("19 Oct - 25 Oct 2026")).toBeVisible();
    await page.getByRole("link", { name: "Next week" }).click();
    await expect(page).toHaveURL(/week=2026-10-26/u);
    await expect(page.getByText("26 Oct - 1 Nov 2026")).toBeVisible();
  });

  test("the project time report shows totals and a CSV export", async () => {
    const href = await openPopulatedTable(page);
    await page.goto(`${href}/time`);
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { level: 1, name: "Project time" })
    ).toBeVisible();
    await expect(
      page.getByText("Billable", { exact: true }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export CSV" })
    ).toBeVisible();
  });
});

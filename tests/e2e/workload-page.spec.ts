import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const WEEKS = 8;

const openWorkload = async (page: Page) => {
  await page.goto("/workload");
  await expect(
    page.getByRole("heading", { level: 1, name: "Workload" })
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
};

test.describe("Workload (/workload)", () => {
  test("lists each teammate against the next eight weeks", async ({ page }) => {
    await openWorkload(page);

    const table = page.getByRole("table", {
      name: "Open tasks and estimated hours due per person, by week",
    });
    await expect(table).toBeVisible();
    // Person, eight weeks and the no-due-date column.
    await expect(table.getByRole("columnheader")).toHaveCount(WEEKS + 2);
    await expect(
      table.getByRole("columnheader", { name: "No due date" })
    ).toBeVisible();
    await expect(table.getByRole("rowheader").first()).toBeVisible();
  });

  test("explains what over capacity means", async ({ page }) => {
    await openWorkload(page);

    await expect(
      page.getByText(/is over capacity when more than \d+ hours/u)
    ).toBeVisible();
  });

  test("the sidebar links to the page", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Workload" }).first().click();

    await expect(page).toHaveURL(/\/workload$/u);
    await expect(
      page.getByRole("heading", { level: 1, name: "Workload" })
    ).toBeVisible();
  });

  test("has no automatically detectable accessibility violations", async ({
    page,
  }) => {
    await openWorkload(page);
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

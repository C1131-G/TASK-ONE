import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const openTimeline = async (page: Page) => {
  await page.goto("/timeline");
  await expect(
    page.getByRole("heading", { level: 1, name: "Timeline" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Weeks" })).toBeVisible();
};

test.describe("Timeline (/timeline)", () => {
  test("renders the page heading and the timeline controls", async ({
    page,
  }) => {
    await openTimeline(page);

    await expect(
      page.getByRole("region", { name: "Workspace task timeline" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Work timeline" })
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Search timeline tasks" })
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Filter timeline by status" })
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Filter timeline by priority" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Today" })).toBeVisible();
  });

  test("the scale buttons report which one is pressed", async ({ page }) => {
    await openTimeline(page);
    const weeks = page.getByRole("button", { name: "Weeks" });
    const months = page.getByRole("button", { name: "Months" });

    await months.click();
    await expect(months).toHaveAttribute("aria-pressed", "true");
    await expect(weeks).toHaveAttribute("aria-pressed", "false");

    await weeks.click();
    await expect(weeks).toHaveAttribute("aria-pressed", "true");
    await expect(months).toHaveAttribute("aria-pressed", "false");
  });

  test("searching for a missing task empties the rows, clearing restores them", async ({
    page,
  }) => {
    await openTimeline(page);
    const search = page.getByRole("searchbox", {
      name: "Search timeline tasks",
    });
    // Group and milestone lane headings stay while no task matches.
    const rows = page
      .getByRole("list", { name: "Timeline tasks" })
      .locator("a.timeline-row-link");
    const before = await rows.count();

    await search.fill("zzqx no task has this title");
    await expect(rows).toHaveCount(0);

    await search.clear();
    await expect(rows).toHaveCount(before);
  });

  test("a task id in the URL does not break the page", async ({ page }) => {
    await page.goto("/timeline?task=not-a-real-task");

    await expect(
      page.getByRole("heading", { level: 1, name: "Timeline" })
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Workspace task timeline" })
    ).toBeVisible();
  });

  test("the timeline passes axe", async ({ page }) => {
    await openTimeline(page);
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

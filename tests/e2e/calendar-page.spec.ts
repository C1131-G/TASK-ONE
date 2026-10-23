import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Calendar (/calendar)", () => {
  test("renders the month grid with its navigation", async ({ page }) => {
    await page.goto("/calendar");

    await expect(
      page.getByRole("heading", { level: 1, name: "Calendar" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Previous month" })
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Next month" })).toBeVisible();
    const toggle = page.getByLabel("Calendar view");
    await expect(toggle.getByRole("link", { name: "Month" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(
      page.getByRole("searchbox", { name: "Search calendar tasks" })
    ).toBeVisible();
  });

  test("next and previous move the month label and Today returns", async ({
    page,
  }) => {
    await page.goto("/calendar");
    const label = page.locator('h2.calendar-month-label[aria-live="polite"]');
    await expect(label).not.toBeEmpty();
    const current = (await label.textContent()) ?? "";

    await page.getByRole("link", { name: "Next month" }).click();
    await expect(page).toHaveURL(/monthOffset=1/u);
    await expect(label).not.toHaveText(current);

    await page.getByRole("link", { name: "Previous month" }).click();
    await expect(page).toHaveURL(/monthOffset=0/u);
    await page.getByRole("link", { name: "Previous month" }).click();
    await expect(page).toHaveURL(/monthOffset=-1/u);
    await expect(label).not.toHaveText(current);

    await page.getByRole("link", { name: "Today" }).click();
    await expect(label).toHaveText(current);
  });

  test("the week view relabels navigation and keeps the mode in the URL", async ({
    page,
  }) => {
    await page.goto("/calendar");

    await page
      .getByLabel("Calendar view")
      .getByRole("link", { name: "Week" })
      .click();
    await expect(page).toHaveURL(/calendarMode=week/u);
    await expect(page.getByRole("link", { name: "Next week" })).toBeVisible();
    await expect(
      page.getByLabel("Calendar view").getByRole("link", { name: "Week" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("an out of range or invalid offset falls back to a valid month", async ({
    page,
  }) => {
    await page.goto("/calendar?monthOffset=9999&calendarMode=bogus");

    await expect(
      page.locator('h2.calendar-month-label[aria-live="polite"]')
    ).not.toBeEmpty();
    await expect(page.getByRole("link", { name: "Next month" })).toBeVisible();
  });

  test("the new event dialog requires a title and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/calendar");
    // The page header and the events section each carry a New event button.
    await page.getByRole("button", { name: "New event" }).first().click();

    const dialog = page.getByRole("dialog", { name: "New event" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Event title")).toHaveAttribute(
      "required",
      ""
    );
    await dialog.getByRole("button", { name: "Create event" }).click();
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the calendar passes axe", async ({ page }) => {
    await page.goto("/calendar");
    await expect(
      page.locator('h2.calendar-month-label[aria-live="polite"]')
    ).not.toBeEmpty();
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

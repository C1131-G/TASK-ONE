import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const openFiles = async (page: Page) => {
  await page.goto("/files");
  await expect(
    page.getByRole("heading", { level: 1, name: "Files" })
  ).toBeVisible();
  await expect(page.locator(".file-project").first()).toBeVisible();
};

test.describe("Files (/files)", () => {
  test("lists a section per project with a link into the project files", async ({
    page,
  }) => {
    await openFiles(page);

    await expect(
      page.getByText("Files shared with your projects.")
    ).toBeVisible();
    const sections = page.locator(".file-project");
    const link = sections
      .first()
      .getByRole("link", { name: "Open project files" });
    await expect(link).toHaveAttribute("href", /\/projects\/.+\?view=files/u);
  });

  test("each project offers search, type, sort and layout controls", async ({
    page,
  }) => {
    await openFiles(page);
    const files = page.locator(".project-files").first();

    await expect(
      files.getByRole("searchbox", { name: "Search project files" })
    ).toBeVisible();
    await expect(
      files.getByRole("button", { name: "Grid view" })
    ).toBeVisible();
    await expect(
      files.getByRole("button", { name: "List view" })
    ).toBeVisible();
  });

  test("searching for a file that does not exist hides every result", async ({
    page,
  }) => {
    await openFiles(page);
    const files = page.locator(".project-files").first();

    await files
      .getByRole("searchbox", { name: "Search project files" })
      .fill("zzqx-no-such-file.pdf");
    await expect(files.locator(".file-results")).toHaveCount(0);
    await expect(
      files.getByRole("heading", { name: "No files match these filters" })
    ).toBeVisible();
  });

  test("the layout switch reports the active layout", async ({ page }) => {
    await openFiles(page);
    const files = page.locator(".project-files").first();
    const list = files.getByRole("button", { name: "List view" });

    await list.click();
    await expect(list).toHaveAttribute("aria-pressed", "true");
    await expect(
      files.getByRole("button", { name: "Grid view" })
    ).toHaveAttribute("aria-pressed", "false");
  });

  test("the files page passes axe", async ({ page }) => {
    await openFiles(page);
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

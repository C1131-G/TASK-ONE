import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Bugs (/bugs)", () => {
  test("renders the heading, display switch and status filters", async ({
    page,
  }) => {
    await page.goto("/bugs");

    await expect(
      page.getByRole("heading", { level: 1, name: "Bugs" })
    ).toBeVisible();
    const display = page.getByRole("navigation", { name: "Bug display" });
    await expect(display.getByRole("link", { name: "List" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await expect(display.getByRole("link", { name: "Board" })).toBeVisible();
    await expect(
      display.getByRole("link", { name: "Client queue" })
    ).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Filter bugs by status" })
        .getByRole("link", { name: "All" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("switching display and status keeps the choice in the URL", async ({
    page,
  }) => {
    await page.goto("/bugs");
    const display = page.getByRole("navigation", { name: "Bug display" });

    await display.getByRole("link", { name: "Board" }).click();
    await expect(page).toHaveURL(/view=board/u);
    await expect(display.getByRole("link", { name: "Board" })).toHaveAttribute(
      "aria-current",
      "page"
    );

    await display.getByRole("link", { name: "Client queue" }).click();
    await expect(page).toHaveURL(/view=client_queue/u);
    // The status filters only apply to the tracker views.
    await expect(
      page.getByRole("navigation", { name: "Filter bugs by status" })
    ).toHaveCount(0);

    await display.getByRole("link", { name: "List" }).click();
    await page
      .getByRole("navigation", { name: "Filter bugs by status" })
      .getByRole("link", { name: "Reported" })
      .click();
    await expect(page).toHaveURL(/status=reported/u);
  });

  test("searching puts the query in the URL and keeps it in the field", async ({
    page,
  }) => {
    await page.goto("/bugs");
    const search = page.getByRole("searchbox", {
      name: "Search bugs and fix history",
    });

    await search.fill("no such bug anywhere zzqx");
    await search.press("Enter");
    await expect(page).toHaveURL(/q=no\+such\+bug\+anywhere\+zzqx/u);
    await expect(
      page.getByRole("searchbox", { name: "Search bugs and fix history" })
    ).toHaveValue("no such bug anywhere zzqx");
    await expect(
      page.getByText("No bug reports match these filters.")
    ).toBeVisible();
  });

  test("the archived toggle swaps its label and the URL flag", async ({
    page,
  }) => {
    await page.goto("/bugs");

    // A click before the page hydrates is swallowed, so click until it lands.
    await expect(async () => {
      await page.getByRole("link", { name: "Include archived" }).click();
      await expect(page).toHaveURL(/archived=true/u, { timeout: 2000 });
    }).toPass({ timeout: 20_000 });
    await page.getByRole("link", { name: "Active bugs" }).click();
    await expect(page).not.toHaveURL(/archived=true/u);
    await expect(
      page.getByRole("link", { name: "Include archived" })
    ).toBeVisible();
  });

  test("the report dialog asks for the required fields and closes on Escape", async ({
    page,
  }) => {
    await page.goto("/bugs");
    const trigger = page.getByRole("button", { name: "Report bug" });
    await expect(trigger).toBeEnabled();
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Report a bug" });
    await expect(dialog).toBeVisible();
    await Promise.all(
      ["Title", "Page or component", "URL or route"].map((label) =>
        expect(dialog.getByLabel(label)).toHaveAttribute("required", "")
      )
    );
    await expect(
      dialog.getByRole("button", { name: "Find earlier reports" })
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the bugs page passes axe", async ({ page }) => {
    await page.goto("/bugs");
    await expect(
      page.getByRole("heading", { level: 1, name: "Bugs" })
    ).toBeVisible();
    await expect(
      page.getByRole("searchbox", { name: "Search bugs and fix history" })
    ).toBeVisible();
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

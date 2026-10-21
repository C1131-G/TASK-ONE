import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { EMPLOYEE_STATE } from "./auth-state";
import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

test.describe("Bug approvals (/bug-approvals)", () => {
  test("an admin sees the approval inbox", async ({ page }) => {
    await page.goto("/bug-approvals");

    await expect(
      page.getByRole("heading", { level: 1, name: "Bug approvals" })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Review verified fixes and their before and after evidence."
      )
    ).toBeVisible();
    // Either bugs wait for approval or the empty state says none do.
    await expect(
      page
        .locator(".bug-list")
        .or(page.getByText("No bug fixes are waiting for approval."))
    ).toBeVisible();
  });

  test("the approval inbox passes axe", async ({ page }) => {
    await page.goto("/bug-approvals");
    await expect(
      page.getByRole("heading", { level: 1, name: "Bug approvals" })
    ).toBeVisible();
    await expect(
      page
        .locator(".bug-list")
        .or(page.getByText("No bug fixes are waiting for approval."))
    ).toBeVisible();
    await settleAnimations(page);

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test.describe("as an employee", () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test("is sent back to the bug tracker", async ({ page }) => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
      await page.goto("/bug-approvals");

      await page.waitForURL((url) => url.pathname === "/bugs");
      await expect(
        page.getByRole("heading", { level: 1, name: "Bugs" })
      ).toBeVisible();
    });
  });
});

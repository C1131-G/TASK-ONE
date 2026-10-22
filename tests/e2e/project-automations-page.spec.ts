import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const openPopulatedProject = async (page: Page, view: string) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=${view}`);
  await page.waitForLoadState("networkidle");
};

test.describe("Project automations (/projects/[projectId]?view=automations)", () => {
  test.describe("automations as admin", () => {
    test.use({ storageState: ADMIN_STATE });
    test.describe.configure({ mode: "serial" });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("an administrator builds, disables, edits and removes an automation", async ({
      page,
    }) => {
      const name = `E2E automation ${Date.now()}`;
      await openPopulatedProject(page, "board");
      await page.getByRole("link", { name: "Automations" }).click();
      await expect(
        page.getByRole("heading", { level: 2, name: "Automations" })
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 2, name: "Run log" })
      ).toBeVisible();

      await page.getByRole("button", { name: "New automation" }).click();
      const form = page.getByRole("form", { name: "New automation" });
      await form.getByLabel("Name").fill(name);

      // An empty rule is refused with a reason beside the form.
      await form.getByRole("button", { name: "Save automation" }).click();
      await expect(form.getByRole("alert")).toContainText("Add at least one");

      await form.getByRole("button", { name: "Add action" }).click();
      await form.getByRole("button", { name: "Save automation" }).click();

      const rule = page.locator("[data-automation-rule]").filter({
        hasText: name,
      });
      await expect(rule).toBeVisible();
      await expect(rule).toContainText("Task created");
      await expect(rule).toContainText("Set priority to Medium");
      await expect(rule.getByText("Enabled", { exact: true })).toBeVisible();

      await rule.getByRole("button", { name: `Disable ${name}` }).click();
      await expect(rule.getByText("Disabled", { exact: true })).toBeVisible();

      await rule.getByRole("button", { name: `Edit ${name}` }).click();
      const editForm = page.getByRole("form", { name: "Edit automation" });
      await editForm.getByLabel("Name").fill(`${name} renamed`);
      await editForm.getByRole("button", { name: "Save automation" }).click();
      const renamed = page.locator("[data-automation-rule]").filter({
        hasText: `${name} renamed`,
      });
      await expect(renamed).toBeVisible();

      await renamed
        .getByRole("button", { name: `Remove ${name} renamed` })
        .click();
      await page.getByRole("button", { name: "Remove automation" }).click();
      await expect(page.getByText(`${name} renamed`)).toHaveCount(0);
    });
  });

  test.describe("automations as an employee", () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
    });

    test("only administrators see the tab or the rules", async ({ page }) => {
      await openPopulatedProject(page, "board");
      await expect(page.getByRole("link", { name: "Automations" })).toHaveCount(
        0
      );
      await openPopulatedProject(page, "automations");
      await expect(page.getByRole("alert")).toContainText(
        "Only administrators can manage automations."
      );
      await expect(page.locator("[data-automation-rule]")).toHaveCount(0);
    });
  });
});

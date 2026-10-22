import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const TASK_PARAM = /[?&]task=[0-9a-f-]{36}/u;

const openPopulatedProject = async (page: Page, view: string) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=${view}`);
  await page.waitForLoadState("networkidle");
  return href ?? "";
};

test.describe("Custom fields (/projects/[projectId]/fields)", () => {
  test.describe("custom fields as admin", () => {
    test.use({ storageState: ADMIN_STATE });
    test.describe.configure({ mode: "serial" });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("an administrator defines a field, a task fills it in, and it is archived", async ({
      page,
    }) => {
      const name = `E2E note ${Date.now()}`;
      const href = await openPopulatedProject(page, "table");
      await page.getByRole("link", { name: "Fields" }).click();
      await expect(
        page.getByRole("heading", { level: 1, name: "Custom fields" })
      ).toBeVisible();

      // An empty name is refused beside the field.
      await page.getByRole("button", { name: "Add field" }).click();
      await expect(page.getByRole("alert").first()).toContainText(
        "Enter a field name"
      );

      await page.getByLabel("Name").fill(name);
      await page.getByRole("button", { name: "Add field" }).click();
      await expect(
        page.getByRole("listitem").filter({ hasText: name })
      ).toBeVisible();

      await page.goto(`${href}?view=table`);
      await page.waitForLoadState("networkidle");
      await page
        .getByRole("button", { name: /^Open details for/u })
        .first()
        .click();
      await expect(page).toHaveURL(TASK_PARAM, { timeout: 30_000 });
      const fields = page
        .getByRole("dialog")
        .getByRole("region", { name: "Fields" });
      await expect(fields).toBeVisible({ timeout: 15_000 });
      const input = fields.getByLabel(name);
      await input.fill("Called the client");
      await input.blur();
      await expect(fields.getByRole("alert")).toHaveCount(0);

      // The value is stored, not just shown: it survives a reload.
      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("region", { name: "Fields" })
          .getByLabel(name)
      ).toHaveValue("Called the client", { timeout: 15_000 });

      await page.goto(`${href}/fields`);
      await page.waitForLoadState("networkidle");
      await page.getByRole("button", { name: `Archive ${name}` }).click();
      await page.getByRole("button", { name: "Archive field" }).click();
      await expect(page.getByText(name)).toHaveCount(0);
    });
  });

  test.describe("custom fields as an employee", () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
    });

    test("only administrators see the Fields tab or can define fields", async ({
      page,
    }) => {
      const href = await openPopulatedProject(page, "table");
      await expect(page.getByRole("link", { name: "Fields" })).toHaveCount(0);
      await page.goto(`${href}/fields`);
      await expect(
        page.getByText("Only administrators can define custom fields.")
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Add field" })).toHaveCount(
        0
      );
    });
  });
});

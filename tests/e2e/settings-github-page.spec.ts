import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const openGithub = async (page: Page) => {
  await page.goto("/settings/github");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1, name: "GitHub" })
  ).toBeVisible();
};

test.describe("GitHub (/settings/github)", () => {
  test.describe("GitHub as admin", () => {
    test.use({ storageState: ADMIN_STATE });
    test.describe.configure({ mode: "serial" });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("shows the webhook URL to paste into GitHub", async ({ page }) => {
      await openGithub(page);
      await expect(page.getByLabel("Payload URL")).toHaveValue(
        /\/api\/integrations\/github$/u
      );
    });

    test("a malformed repository name is refused beside its field", async ({
      page,
    }) => {
      await openGithub(page);
      await page.getByLabel("Repository").fill("not a repository");
      await page.getByRole("button", { name: "Connect repository" }).click();
      await expect(page.getByRole("alert").first()).toContainText(
        /owner\/name/u
      );
    });

    test("a connection shows its secret once, then can be disabled and rotated", async ({
      page,
    }) => {
      const repo = `e2e/repo-${Date.now()}`;
      await openGithub(page);
      await page.getByLabel("Repository").fill(repo);
      await page.getByRole("button", { name: "Connect repository" }).click();

      const secret = page.locator("[data-webhook-secret] input");
      await expect(secret).toHaveValue(/^whsec_/u);
      const card = page.getByRole("article", { name: repo });
      await expect(card).toBeVisible();
      await expect(card.getByText(/Ends in /u)).toBeVisible();

      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("[data-webhook-secret]")).toHaveCount(0);

      const reloaded = page.getByRole("article", { name: repo });
      await reloaded.getByRole("button", { name: "Disable" }).click();
      await expect(reloaded.getByText("Disabled")).toBeVisible();

      await reloaded.getByRole("button", { name: "New secret" }).click();
      await page.getByRole("button", { name: "Generate new secret" }).click();
      await expect(page.locator("[data-webhook-secret] input")).toHaveValue(
        /^whsec_/u
      );
    });
  });

  test.describe("GitHub as an employee", () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
    });

    test("is sent back to the home page", async ({ page }) => {
      await page.goto("/settings/github");
      await page.waitForURL((url) => url.pathname === "/");
      await expect(
        page.getByRole("heading", { level: 1, name: "GitHub" })
      ).toHaveCount(0);
    });
  });
});

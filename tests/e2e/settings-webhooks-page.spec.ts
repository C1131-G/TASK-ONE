import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const openWebhooks = async (page: Page) => {
  await page.goto("/settings/webhooks");
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1, name: "Webhooks" })
  ).toBeVisible();
};

test.describe("Webhooks (/settings/webhooks)", () => {
  test.describe("webhooks as admin", () => {
    test.use({ storageState: ADMIN_STATE });
    test.describe.configure({ mode: "serial" });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("an endpoint pointing at a private address is refused beside its field", async ({
      page,
    }) => {
      await openWebhooks(page);
      await page
        .getByLabel("Name", { exact: true })
        .first()
        .fill("Metadata probe");
      await page
        .getByLabel("Endpoint URL")
        .fill("https://169.254.169.254/latest/");
      await page.getByRole("button", { name: "Add endpoint" }).click();
      await expect(page.getByRole("alert").first()).toContainText(
        /not allowed|blocked/iu
      );
      await expect(page.getByText("Metadata probe")).toHaveCount(0);
    });

    test("a Slack endpoint must use a Slack host", async ({ page }) => {
      await openWebhooks(page);
      await page.getByLabel("Name", { exact: true }).first().fill("Not Slack");
      await page.getByLabel("Type").selectOption("slack");
      await page
        .getByLabel("Slack webhook URL")
        .fill("https://example.com/services/T000/B000/XXXX");
      await page.getByRole("button", { name: "Add endpoint" }).click();
      await expect(page.getByRole("alert").first()).toContainText(/Slack/u);
    });

    test("a signed endpoint shows its secret once, then can be disabled and removed", async ({
      page,
    }) => {
      const name = `E2E receiver ${Date.now()}`;
      await openWebhooks(page);
      await page.getByLabel("Name", { exact: true }).first().fill(name);
      await page
        .getByLabel("Endpoint URL")
        .fill("https://example.com/hooks/e2e");
      await page.getByRole("button", { name: "Add endpoint" }).click();

      const secret = page.locator("[data-webhook-secret] input");
      await expect(secret).toHaveValue(/^whsec_/u);
      const card = page.getByRole("article", { name });
      await expect(card).toBeVisible();
      await expect(card.getByText(/Ends in /u)).toBeVisible();

      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(page.locator("[data-webhook-secret]")).toHaveCount(0);

      const reloaded = page.getByRole("article", { name });
      await reloaded.getByRole("button", { name: "Disable" }).click();
      await expect(reloaded.getByText("Disabled")).toBeVisible();
      await expect(reloaded.getByText("No deliveries yet.")).toBeVisible();

      await reloaded.getByRole("button", { name: "Remove" }).click();
      await page.getByRole("button", { name: "Remove endpoint" }).click();
      await expect(page.getByRole("article", { name })).toHaveCount(0);
    });
  });

  test.describe("webhooks as an employee", () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
    });

    test("is sent back to the home page", async ({ page }) => {
      await page.goto("/settings/webhooks");
      await page.waitForURL((url) => url.pathname === "/");
      await expect(
        page.getByRole("heading", { level: 1, name: "Webhooks" })
      ).toHaveCount(0);
    });
  });
});

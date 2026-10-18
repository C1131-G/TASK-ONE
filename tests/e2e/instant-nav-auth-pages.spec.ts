import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

test.use({ storageState: { cookies: [], origins: [] } });

test("request-access steps are in the initial-load shell", async ({ page }) => {
  await instant(
    page,
    async () => {
      await page.goto("/signup");
      await expect(page.getByTestId("auth-shell-marker")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Request access" })
      ).toBeVisible();
      await expect(page.getByText("Ask your administrator")).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
});

test("change-password card and form skeleton commit on initial load", async ({
  page,
}) => {
  await instant(
    page,
    async () => {
      await page.goto("/change-password");
      await expect(page.getByTestId("auth-shell-marker")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Set a new password" })
      ).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
});

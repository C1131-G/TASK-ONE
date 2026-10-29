import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

test.use({ storageState: { cookies: [], origins: [] } });

test("login form is in the initial-load shell", async ({ page }) => {
  await instant(
    page,
    async () => {
      await page.goto("/login");
      await expect(page.getByTestId("auth-shell-marker")).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "Welcome back" })
      ).toBeVisible();
      await expect(
        page.getByText("Sign in to your Taskora workspace")
      ).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
});

test("login to request-access navigation renders the destination instantly", async ({
  page,
}) => {
  await page.goto("/login");
  const requestAccessLink = page
    .getByTestId("auth-shell-marker")
    .getByRole("link", { exact: true, name: "Request access" });

  await instant(page, async () => {
    await requestAccessLink.click();
    await expect(page).toHaveURL(/\/signup$/u);
    await expect(
      page.getByRole("region", { name: "Request access" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Request access" })
    ).toBeVisible();
    await expect(
      page.getByText("Taskora accounts are created by an administrator.")
    ).toBeVisible();
  });
});

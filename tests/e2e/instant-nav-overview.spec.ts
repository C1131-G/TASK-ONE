import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

const expectOverviewShell = async (page: Page) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Workspace overview" })
  ).toBeVisible();
};

const expectOverviewContent = async (page: Page) => {
  await expect(
    page.getByRole("heading", { level: 2, name: "Portfolio" })
  ).toBeVisible();
};

test("overview heading and content render on the initial request", async ({
  page,
}) => {
  await instant(
    page,
    async () => {
      await page.goto("/overview");
      await expectOverviewShell(page);
      await expect(
        page.getByRole("navigation", { name: "Main" })
      ).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
  await expectOverviewContent(page);
});

test("overview heading and navigation are available on initial load", async ({
  page,
}) => {
  await instant(
    page,
    async () => {
      await page.goto("/overview");
      await expectOverviewShell(page);
      await expect(
        page.getByRole("navigation", { name: "Main" })
      ).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
  await expectOverviewContent(page);
});

test("tasks to overview navigation renders the destination instantly", async ({
  page,
}) => {
  await page.goto("/tasks");
  const link = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Overview" });
  await expect(link).toBeVisible();

  await instant(page, async () => {
    await link.click();
    await expect(page).toHaveURL(/\/overview$/u);
    await expectOverviewShell(page);
  });
  await expectOverviewContent(page);
});

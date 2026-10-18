import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";
const TASK_PARAM = /[?&]task=[0-9a-f-]{36}/u;

test("a deep-linked task keeps the page shell instant and the drawer settles", async ({
  page,
}) => {
  await page.goto("/tasks");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page
      .getByRole("button", { name: /^Open details for/u })
      .first()
      .click();
    await expect(page).toHaveURL(TASK_PARAM, { timeout: 2000 });
  }).toPass();
  const link = new URL(page.url());
  const target = `${link.pathname}${link.search}`;

  await instant(
    page,
    async () => {
      await page.goto(target);
      await expect(
        page.getByRole("heading", { level: 1, name: "Tasks" })
      ).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Details" })
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator("output:visible", { hasText: "Loading task details" })
  ).toHaveCount(0);
});

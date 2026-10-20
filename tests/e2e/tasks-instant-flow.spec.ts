import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

const expectTasksShell = async (page: Page) => {
  await expect(
    page.getByRole("heading", { level: 1, name: "Tasks" })
  ).toBeVisible();
};

const expectTasksContent = async (page: Page) => {
  await expect(
    page.getByRole("navigation", { name: "Task view" })
  ).toBeVisible();
};

test("tasks heading and navigation are available on initial load", async ({
  page,
}) => {
  await instant(
    page,
    async () => {
      await page.goto("/tasks");
      await expectTasksShell(page);
      await expect(
        page.getByRole("navigation", { name: "Main" })
      ).toBeVisible();
    },
    { baseURL: BASE_URL }
  );
  await expectTasksContent(page);
});

test("overview to tasks navigation renders the destination instantly", async ({
  page,
}) => {
  await page.goto("/overview");
  const link = page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { exact: true, name: "Tasks" });
  await expect(link).toBeVisible();

  await instant(page, async () => {
    await link.click();
    await expect(page).toHaveURL(/\/tasks$/u);
    await expectTasksShell(page);
  });
  await expectTasksContent(page);
});

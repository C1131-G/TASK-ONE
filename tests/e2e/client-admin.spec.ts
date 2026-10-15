import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

test.use({ storageState: ADMIN_STATE });

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const expectNoViolations = async (page: Page, where: string) => {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(
    results.violations.map((violation) => violation.id),
    `axe violations on ${where}`
  ).toEqual([]);
};

const openAcme = async (page: Page) => {
  await page.goto("/clients");
  await page
    .locator("main")
    .getByRole("link", { name: /Acme/u })
    .first()
    .click();
  await page.waitForURL(/\/clients\/[0-9a-f-]+/u);
};

test("the clients list, a company and the audit log pass axe", async ({
  page,
}) => {
  await page.goto("/clients");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoViolations(page, "/clients");

  await openAcme(page);
  await expect(page.getByRole("tab", { name: "Insight" })).toBeVisible();
  await page.getByRole("tab", { name: "Insight" }).click();
  await expectNoViolations(page, "company insight");

  await page.goto("/clients/audit");
  await expect(page.getByRole("table")).toBeVisible();
  await expectNoViolations(page, "/clients/audit");
});

test("viewing as a client is read-only and can be exited", async ({ page }) => {
  await openAcme(page);
  await page
    .getByRole("link", { name: /View as client/u })
    .first()
    .click();
  await page.waitForURL(/\/portal/u);
  await expect(page.getByRole("link", { name: /Exit preview/u })).toBeVisible();
  await expectNoViolations(page, "portal preview");

  await page.goto("/portal/new");
  await page.getByRole("link", { name: /Exit preview/u }).click();
  await page.waitForURL(/\/clients/u);
});

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, CLIENT_ONE_STATE } from "./auth-state";
import { settleAnimations } from "./settle-animations";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const expectNoViolations = async (page: Page, where: string) => {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // Name the offending elements, not only the rule, so a CI failure is enough
  // to find the node without reproducing the run.
  expect(
    results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes
          .slice(0, 5)
          .map((node) => node.target.join(" "))
          .join(" | ")}`
    ),
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

test.describe("Clients (/clients)", () => {
  test.use({ storageState: ADMIN_STATE });

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

  test("viewing as a client is read-only and can be exited", async ({
    page,
  }) => {
    await openAcme(page);
    await page
      .getByRole("link", { name: /View as client/u })
      .first()
      .click();
    await page.waitForURL(/\/portal/u);
    await expect(
      page.getByRole("link", { name: /Exit preview/u })
    ).toBeVisible();
    await expectNoViolations(page, "portal preview");

    await page.goto("/portal/new");
    await page.getByRole("link", { name: /Exit preview/u }).click();
    await page.waitForURL(/\/clients/u);
  });

  // A 1×1 PNG stands in for a real logo.
  const LOGO = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"
  );

  test.describe("the company logo", () => {
    test.describe.configure({ mode: "serial" });

    test("an admin uploads it", async ({ page }) => {
      await openAcme(page);
      await page.getByLabel(/Choose a logo image for Acme/u).setInputFiles({
        buffer: LOGO,
        mimeType: "image/png",
        name: "acme.png",
      });
      await expect(page.getByRole("img", { name: "Acme logo" })).toBeVisible({
        timeout: 30_000,
      });
    });

    test.describe("then a client", () => {
      test.use({ storageState: CLIENT_ONE_STATE });

      test("sees it in the portal header", async ({ page }) => {
        await page.goto("/portal");
        await expect(
          page.getByRole("banner").getByRole("img", { name: "Acme logo" })
        ).toBeVisible();
      });
    });
  });
});

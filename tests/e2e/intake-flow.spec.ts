import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

// Public intake, end to end: an admin creates a form, a stranger with no
// account files a report through its link and sees a reference, the report
// reaches triage, and rotating or disabling the form retires the old link.
// Needs scripts/seed-e2e-accounts.ts to have run (the Acme company and its
// project) and the admin account the setup project signs in.

const REPORT_TITLE = `Intake export fails ${Date.now()}`;
const FORM_NAME = `Acme support ${Date.now()}`;
// The form refuses a submission sent within a few seconds of loading.
const HUMAN_PAUSE_MS = 3500;
const REFERENCE = /INT-[A-Z0-9]{8}/u;

let publicPath = "";

test.describe.configure({ mode: "serial" });

const readFormPath = async (page: Page): Promise<string> => {
  const row = page.locator("[data-intake-form]", { hasText: FORM_NAME });
  await expect(row).toBeVisible();
  return await row.getByLabel("Public link").inputValue();
};

const notAvailable = async (page: Page, path: string) => {
  await page.goto(path);
  await expect(
    page.getByRole("heading", { name: "Page not found" })
  ).toBeVisible();
};

test.describe("Intake (public form to triage)", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("an admin creates a form and gets its public link", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto("/settings?section=intake");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Form name").fill(FORM_NAME);
    await page.getByLabel("Client company").click();
    await page.getByRole("option", { name: "Acme" }).click();
    await page.getByLabel("Project").click();
    await page.getByRole("option", { name: /^ACMEP/u }).click();
    await page.getByRole("button", { name: "Create form" }).click();

    publicPath = await readFormPath(page);
    expect(publicPath).toMatch(/^\/intake\/[A-Za-z0-9_-]{22}$/u);
    await context.close();
  });

  test("a visitor without an account files a report and sees a reference", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(publicPath);
    await expect(
      page.getByRole("heading", { name: "Report a problem" })
    ).toBeVisible();
    await page.getByLabel("Title").fill(REPORT_TITLE);
    await page
      .getByLabel("What happened?")
      .fill("Exporting the invoice list does nothing.");
    await page.getByLabel("Your email").fill("visitor@example.com");
    // The decoy field is out of sight and out of the tab order.
    await expect(page.locator("#intake-website")).not.toBeInViewport();
    await page.waitForTimeout(HUMAN_PAUSE_MS);
    await page.getByRole("button", { name: "Send report" }).click();

    await expect(page).toHaveURL(/\/received\?ref=INT-/u);
    await expect(
      page.getByRole("heading", { name: /your report was received/iu })
    ).toBeVisible();
    await expect(page.getByTestId("intake-reference")).toHaveText(REFERENCE);
    await context.close();
  });

  test("the report is waiting for triage and the admin was notified", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto("/bugs");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(REPORT_TITLE).first()).toBeVisible();

    await page.goto("/notifications");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/New intake report/u).first()).toBeVisible();
    await context.close();
  });

  test("a rejected field is explained without losing the form", async ({
    browser,
  }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(publicPath);
    await page.getByLabel("Title").fill("Bad email report");
    await page.getByLabel("What happened?").fill("It broke.");
    await page.getByLabel("Your email").fill("not-an-email@@");
    await page.waitForTimeout(HUMAN_PAUSE_MS);
    await page
      .getByRole("button", { name: "Send report" })
      .dispatchEvent("click");
    await expect(page.getByRole("alert").first()).toBeVisible();
    await expect(page).toHaveURL(publicPath);
    await context.close();
  });

  test("an unknown link and a disabled form look the same", async ({
    browser,
  }) => {
    const admin = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await admin.newPage();
    await adminPage.goto("/settings?section=intake");
    await adminPage.waitForLoadState("networkidle");
    const row = adminPage.locator("[data-intake-form]", {
      hasText: FORM_NAME,
    });
    await row.getByRole("button", { name: "Disable" }).click();
    await expect(row.getByRole("button", { name: "Enable" })).toBeVisible();

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await notAvailable(page, publicPath);
    await notAvailable(page, "/intake/AAAAAAAAAAAAAAAAAAAAAA");
    await visitor.close();

    await row.getByRole("button", { name: "Enable" }).click();
    await expect(row.getByRole("button", { name: "Disable" })).toBeVisible();
    await admin.close();
  });

  test("rotating the link retires the old one", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await admin.newPage();
    await adminPage.goto("/settings?section=intake");
    await adminPage.waitForLoadState("networkidle");
    const row = adminPage.locator("[data-intake-form]", {
      hasText: FORM_NAME,
    });
    await row.getByRole("button", { name: "Rotate link" }).click();
    await adminPage.getByRole("button", { name: "Rotate link" }).last().click();
    await expect
      .poll(async () => await readFormPath(adminPage))
      .not.toBe(publicPath);
    const rotated = await readFormPath(adminPage);

    const visitor = await browser.newContext();
    const page = await visitor.newPage();
    await notAvailable(page, publicPath);
    await page.goto(rotated);
    await expect(
      page.getByRole("heading", { name: "Report a problem" })
    ).toBeVisible();
    await visitor.close();
    await admin.close();
  });
});

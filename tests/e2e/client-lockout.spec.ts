import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { CLIENT_ONE_STATE, PORTAL_ACCOUNTS } from "./auth-state";

// Each attempt comes from its own forwarded address so the per-address
// sign-in rate limit never answers before the account lockout does.
test.use({ storageState: { cookies: [], origins: [] } });

let nextAddress = Date.now() % 200;

const signIn = async (page: Page, password: string) => {
  nextAddress += 1;
  await page.context().setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.${nextAddress}`,
  });
  await page.goto("/login");
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
  await page.fill('input[name="email"]', PORTAL_ACCOUNTS.lockoutClient);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
};

test("five wrong passwords lock the account even for the right one", async ({
  page,
}) => {
  test.skip(!process.env["E2E_PORTAL_PASSWORD"], "E2E_PORTAL_PASSWORD not set");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    await signIn(page, "definitely-wrong-password");
    // eslint-disable-next-line no-await-in-loop
    await expect(page.locator("#login-error")).toBeVisible();
  }
  await signIn(page, process.env["E2E_PORTAL_PASSWORD"] ?? "");
  await expect(page.locator("#login-error")).toContainText(
    /couldn't sign you in/iu
  );
  await expect(page).toHaveURL(/\/login/u);
});

test.describe("a signed-in client", () => {
  test.use({ storageState: CLIENT_ONE_STATE });

  for (const route of ["/", "/bugs", "/projects"]) {
    test(`is sent to the portal from ${route}`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL(/\/portal/u);
      await expect(page.locator("main h1").first()).toBeVisible();
    });
  }
});

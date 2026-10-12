import { existsSync } from "node:fs";

import { expect, test as setup } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

// Signs the admin in once for the whole run. Specs reuse the saved browser state,
// because repeated sign-ins hit the auth rate limit.
setup("admin signs in once", async ({ page }) => {
  setup.skip(
    !process.env["E2E_ADMIN_PASSWORD"],
    "E2E_ADMIN_PASSWORD is not set"
  );
  await page.goto("/login");
  await page.fill('input[name="email"]', "ui-admin@metsys.test");
  await page.fill(
    'input[name="password"]',
    process.env["E2E_ADMIN_PASSWORD"] ?? ""
  );
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/", {
    timeout: 90_000,
    waitUntil: "commit",
  });
  await expect(page).toHaveURL("/");
  await page.context().storageState({ path: ADMIN_STATE });
  expect(existsSync(ADMIN_STATE)).toBe(true);
});

import { existsSync } from "node:fs";

import { expect, test as setup } from "@playwright/test";

import {
  ADMIN_STATE,
  CLIENT_ONE_STATE,
  CLIENT_TWO_STATE,
  EMPLOYEE_STATE,
  HANDLER_STATE,
  HANDLER_TWO_STATE,
  PORTAL_ACCOUNTS,
} from "./auth-state";

// Signs the admin in once for the whole run. Specs reuse the saved browser state,
// because repeated sign-ins hit the auth rate limit.
setup("admin signs in once", async ({ page }) => {
  setup.skip(
    !process.env["E2E_ADMIN_PASSWORD"],
    "E2E_ADMIN_PASSWORD is not set"
  );
  await page.goto("/login");
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
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

setup("employee signs in once", async ({ page }) => {
  setup.skip(
    !process.env["E2E_EMPLOYEE_PASSWORD"],
    "E2E_EMPLOYEE_PASSWORD is not set"
  );
  await page.goto("/login");
  await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
  await page.fill('input[name="email"]', "ui-employee@metsys.test");
  await page.fill(
    'input[name="password"]',
    process.env["E2E_EMPLOYEE_PASSWORD"] ?? ""
  );
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname === "/", {
    timeout: 90_000,
    waitUntil: "commit",
  });
  await page.context().storageState({ path: EMPLOYEE_STATE });
  expect(existsSync(EMPLOYEE_STATE)).toBe(true);
});

const portalSignIns = [
  {
    email: PORTAL_ACCOUNTS.clientOne,
    landing: "/portal",
    name: "client one signs in once",
    path: CLIENT_ONE_STATE,
  },
  {
    email: PORTAL_ACCOUNTS.clientTwo,
    landing: "/portal",
    name: "client two signs in once",
    path: CLIENT_TWO_STATE,
  },
  {
    email: PORTAL_ACCOUNTS.handler,
    landing: "/",
    name: "handler signs in once",
    path: HANDLER_STATE,
  },
  {
    email: PORTAL_ACCOUNTS.handlerTwo,
    landing: "/",
    name: "handler two signs in once",
    path: HANDLER_TWO_STATE,
  },
] as const;

// Sign-in is limited to five attempts a minute per address, so each portal
// account signs in from its own forwarded address.
for (const [index, account] of portalSignIns.entries()) {
  setup(account.name, async ({ page }) => {
    setup.skip(
      !process.env["E2E_PORTAL_PASSWORD"],
      "E2E_PORTAL_PASSWORD is not set"
    );
    await page.context().setExtraHTTPHeaders({
      "x-forwarded-for": `192.0.2.${index + 10}`,
    });
    await page.goto("/login");
    await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
    await page.fill('input[name="email"]', account.email);
    await page.fill(
      'input[name="password"]',
      process.env["E2E_PORTAL_PASSWORD"] ?? ""
    );
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === account.landing, {
      timeout: 90_000,
      waitUntil: "commit",
    });
    await page.context().storageState({ path: account.path });
    expect(existsSync(account.path)).toBe(true);
  });
}

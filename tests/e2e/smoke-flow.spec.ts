import { expect, test } from "@playwright/test";

// These specs test the login form itself, so they start without a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

const roles = [
  {
    email: "ui-admin@taskora.test",
    name: "admin",
    passwordEnv: "E2E_ADMIN_PASSWORD",
  },
  {
    email: "ui-employee@taskora.test",
    name: "employee",
    passwordEnv: "E2E_EMPLOYEE_PASSWORD",
  },
];

for (const role of roles) {
  test(`${role.name} signs in and reaches the projects page`, async ({
    page,
  }) => {
    const password = process.env[role.passwordEnv];
    test.skip(!password, `${role.passwordEnv} is not set`);

    await page.goto("/login");
    await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
    await page.fill('input[name="email"]', role.email);
    await page.fill('input[name="password"]', password ?? "");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname === "/", {
      timeout: 90_000,
      waitUntil: "commit",
    });
    await page.goto("/projects");
    await expect(
      page.getByText("UI Fixture Populated", { exact: false }).first()
    ).toBeVisible();
  });
}

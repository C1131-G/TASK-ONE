import { expect, test } from "@playwright/test";

const roles = [
  {
    email: "ui-admin@metsys.test",
    name: "admin",
    passwordEnv: "E2E_ADMIN_PASSWORD",
  },
  {
    email: "ui-employee@metsys.test",
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
    await page.fill('input[name="email"]', role.email);
    await page.fill('input[name="password"]', password ?? "");
    await page.click('button[type="submit"]');

    await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
    await page.goto("/projects");
    await expect(
      page.getByText("UI Fixture Populated", { exact: false }).first()
    ).toBeVisible();
  });
}

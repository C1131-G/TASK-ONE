import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

test.describe("people as admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("members search and role filters narrow the directory", async ({
    page,
  }) => {
    await page.goto("/members");
    await page.waitForLoadState("networkidle");
    const profileLinks = page.locator("a.members-person-link");
    const total = await profileLinks.count();
    expect(total).toBeGreaterThan(1);

    await page.getByPlaceholder("Search members").fill("Test Employee");
    await expect(profileLinks).toHaveCount(1);
    await expect(profileLinks.first()).toContainText("Test Employee");

    await page.getByPlaceholder("Search members").fill("");
    await page.getByRole("button", { exact: true, name: "Admin" }).click();
    await expect(profileLinks).not.toHaveCount(0);
    await expect(
      page.locator("a.members-person-link", { hasText: "Test Employee" })
    ).toHaveCount(0);
  });

  test("a member profile opens from the directory and shows the person", async ({
    page,
  }) => {
    await page.goto("/members");
    await page.waitForLoadState("networkidle");
    await page
      .locator("a.members-person-link", { hasText: "UI Admin" })
      .click();
    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}$/u, {
      timeout: 30_000,
    });
    await expect(
      page.getByRole("heading", { level: 1, name: /UI Admin/u })
    ).toBeVisible({ timeout: 15_000 });
  });

  test("an admin edits an employee's job title and the change survives a reload", async ({
    page,
  }) => {
    const openManage = async () => {
      await page.goto("/members");
      await page.waitForLoadState("networkidle");
      // Rows and Manage buttons share one order, so match them by position.
      const names = await page
        .locator("a.members-person-link")
        .evaluateAll((links) => links.map((link) => link.textContent ?? ""));
      const index = names.findIndex((name) => name.includes("Test Employee"));
      expect(index).toBeGreaterThanOrEqual(0);
      await page.getByRole("button", { name: "Manage" }).nth(index).click();
      await expect(
        page.getByRole("heading", { name: "Manage employee" })
      ).toBeVisible();
    };
    const saveTitle = async (value: string) => {
      await openManage();
      await page.getByLabel("Job title").fill(value);
      await page.getByRole("button", { name: "Save details" }).click();
      await expect(async () => {
        await openManage();
        await expect(page.getByLabel("Job title")).toHaveValue(value, {
          timeout: 2000,
        });
      }).toPass({ timeout: 30_000 });
    };

    await openManage();
    const original = await page.getByLabel("Job title").inputValue();
    try {
      await saveTitle(`${original} E2E`.trim());
    } finally {
      await saveTitle(original);
    }
  });

  test("a new team is created, the dialog closes and the team opens", async ({
    page,
  }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    const name = `E2E Team ${Date.now()}`;
    await page.getByRole("button", { name: "New team" }).click();
    await page.getByLabel("Team name").fill(name);
    await page.getByRole("button", { name: "Create team" }).click();

    // The dialog must close on success; its overlay would block the page.
    await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
    const card = page.getByRole("link", { name: new RegExp(name, "u") });
    await expect(card).toBeVisible({ timeout: 15_000 });
    await card.click();
    await expect(page).toHaveURL(/\/teams\/[0-9a-f-]{36}$/u, {
      timeout: 30_000,
    });
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("people as employee", () => {
  test.use({ storageState: EMPLOYEE_STATE });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_EMPLOYEE_PASSWORD"],
      "E2E_EMPLOYEE_PASSWORD is not set"
    );
  });

  test("an employee sees the directory without account administration", async ({
    page,
  }) => {
    await page.goto("/members");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("a.members-person-link").first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add employee" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Manage" })).toHaveCount(0);
  });

  test("an employee can browse teams but cannot create one", async ({
    page,
  }) => {
    await page.goto("/teams");
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { level: 1, name: "Teams" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "New team" })).toHaveCount(0);
  });
});

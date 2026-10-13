import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const openSettings = async (page: Page, tab?: string) => {
  await page.goto("/settings");
  await page.waitForLoadState("networkidle");
  if (tab) {
    await page.getByRole("tab", { name: tab }).click();
  }
};

test.describe("settings as admin", () => {
  test.use({ storageState: ADMIN_STATE });
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("the theme choice is applied and survives a reload", async ({
    page,
  }) => {
    await openSettings(page, "Appearance");
    const dark = page.getByRole("radio", { name: /^Dark/u });
    await dark.click();
    await expect(page.locator("html")).toHaveClass(/dark/u);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveClass(/dark/u);

    await page.getByRole("tab", { name: "Appearance" }).click();
    await page.getByRole("radio", { name: /^System/u }).click();
    await expect(page.getByRole("radio", { name: /^System/u })).toBeChecked();
  });

  test("the display name saves and shows in the account menu after a reload", async ({
    page,
  }) => {
    await openSettings(page, "Profile");
    const name = page.getByLabel("Display name");
    const original = await name.inputValue();
    expect(original.length).toBeGreaterThan(0);

    const changed = `${original} E2E`;
    await name.fill(changed);
    await page.getByRole("button", { name: "Save profile" }).click();
    try {
      await expect(
        page
          .getByRole("button", { name: `Account menu for ${changed}` })
          .first()
      ).toBeVisible({ timeout: 20_000 });
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.getByRole("tab", { name: "Profile" }).click();
      await expect(page.getByLabel("Display name")).toHaveValue(changed);
    } finally {
      await openSettings(page, "Profile");
      await page.getByLabel("Display name").fill(original);
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(
        page
          .getByRole("button", { name: `Account menu for ${original}` })
          .first()
      ).toBeVisible({ timeout: 20_000 });
    }
  });

  test("display preferences save and survive a reload", async ({ page }) => {
    await openSettings(page, "Preferences");
    const density = page.getByRole("combobox", { name: /Density/u });
    await expect(density).toHaveText(/Comfortable/u);
    await density.click();
    await page.getByRole("option", { name: "Compact" }).click();
    await page.getByRole("button", { name: "Save preferences" }).click();
    try {
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.getByRole("tab", { name: "Preferences" }).click();
        await expect(
          page.getByRole("combobox", { name: /Density/u })
        ).toHaveText(/Compact/u, { timeout: 2000 });
      }).toPass({ timeout: 30_000 });
    } finally {
      await openSettings(page, "Preferences");
      await page.getByRole("combobox", { name: /Density/u }).click();
      await page.getByRole("option", { name: "Comfortable" }).click();
      await page.getByRole("button", { name: "Save preferences" }).click();
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.getByRole("tab", { name: "Preferences" }).click();
        await expect(
          page.getByRole("combobox", { name: /Density/u })
        ).toHaveText(/Comfortable/u, { timeout: 2000 });
      }).toPass({ timeout: 30_000 });
    }
  });

  test("a notification switch persists across a reload", async ({ page }) => {
    await openSettings(page, "Preferences");
    const toggle = page.locator("#notification-in-app-update");
    const before = await toggle.getAttribute("aria-checked");
    await toggle.click();
    const after = before === "true" ? "false" : "true";
    try {
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.getByRole("tab", { name: "Preferences" }).click();
        await expect(
          page.locator("#notification-in-app-update")
        ).toHaveAttribute("aria-checked", after, { timeout: 2000 });
      }).toPass({ timeout: 30_000 });
    } finally {
      const current = page.locator("#notification-in-app-update");
      if ((await current.getAttribute("aria-checked")) !== before) {
        await current.click();
        await expect(current).toHaveAttribute("aria-checked", before ?? "true");
      }
    }
  });

  test("company settings save and keep the new name after a reload", async ({
    page,
  }) => {
    await openSettings(page, "Workspace");
    const name = page.getByLabel("Company name");
    const original = await name.inputValue();
    const changed = `${original} E2E`;
    const saveCompany = async (value: string) => {
      await page.getByLabel("Company name").fill(value);
      await page.getByRole("button", { name: "Save company settings" }).click();
      await expect(async () => {
        await page.reload();
        await page.waitForLoadState("networkidle");
        await page.getByRole("tab", { name: "Workspace" }).click();
        await expect(page.getByLabel("Company name")).toHaveValue(value, {
          timeout: 2000,
        });
      }).toPass({ timeout: 30_000 });
    };
    try {
      await saveCompany(changed);
    } finally {
      await saveCompany(original);
    }
  });

  test("sessions list the current sign-in and the workspace tab is offered", async ({
    page,
  }) => {
    await openSettings(page, "Sessions");
    await expect(
      page.getByRole("heading", { name: "Active sessions" }).first()
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Revoke" }).first()
    ).toBeVisible();
    await expect(page.getByRole("tab", { name: "Workspace" })).toBeVisible();
  });
});

test.describe("settings as employee", () => {
  test.use({ storageState: EMPLOYEE_STATE });

  test("an employee sees personal settings but no workspace settings", async ({
    page,
  }) => {
    test.skip(
      !process.env["E2E_EMPLOYEE_PASSWORD"],
      "E2E_EMPLOYEE_PASSWORD is not set"
    );
    await openSettings(page);
    await Promise.all(
      ["Appearance", "Profile", "Preferences", "Sessions"].map((tab) =>
        expect(page.getByRole("tab", { name: tab })).toBeVisible()
      )
    );
    await expect(page.getByRole("tab", { name: "Workspace" })).toHaveCount(0);
  });
});

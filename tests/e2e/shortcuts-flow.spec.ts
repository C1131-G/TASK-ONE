import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const openWorkspace = async (page: Page) => {
  await page.goto("/overview");
  await page.waitForLoadState("networkidle");
  // Shortcuts listen on the window once the topbar has hydrated.
  await expect(
    page.getByRole("button", { name: "Search and jump to a page or project" })
  ).toBeVisible();
  // The button is server-rendered, so it shows before the window listener
  // attaches. Open and close the palette until a press registers.
  const palette = page.getByRole("dialog", { name: "Search or jump to" });
  await expect(async () => {
    await page.keyboard.press("ControlOrMeta+k");
    await expect(palette).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette).toBeHidden();
};

test.describe("Keyboard shortcuts flow", () => {
  test.describe("as an admin", () => {
    test.use({ storageState: ADMIN_STATE });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("G then a key jumps between pages", async ({ page }) => {
      await openWorkspace(page);

      await page.keyboard.press("g");
      await page.keyboard.press("t");
      await expect(page).toHaveURL(/\/tasks(?:\?|$)/u);

      await page.keyboard.press("g");
      await page.keyboard.press("p");
      await expect(page).toHaveURL(/\/projects$/u);

      await page.keyboard.press("g");
      await page.keyboard.press("i");
      await expect(page).toHaveURL(/\/inbox$/u);

      await page.keyboard.press("g");
      await page.keyboard.press("h");
      await expect(page).toHaveURL(/\/$/u);
    });

    test("question mark lists the shortcuts and Escape returns focus", async ({
      page,
    }) => {
      await openWorkspace(page);

      await page.keyboard.press("?");
      const help = page.getByRole("dialog", { name: "Keyboard shortcuts" });
      await expect(help).toBeVisible();
      await expect(help.getByText("Create task")).toBeVisible();
      await expect(help.getByText("Go to Inbox")).toBeVisible();

      // A shortcut does nothing while the dialog is open.
      await page.keyboard.press("g");
      await page.keyboard.press("t");
      await expect(page).toHaveURL(/\/overview$/u);

      await page.keyboard.press("Escape");
      await expect(help).toBeHidden();
    });

    test("C opens the new task dialog", async ({ page }) => {
      await openWorkspace(page);

      await page.keyboard.press("c");
      await expect(
        page.getByRole("dialog", { name: "New task" })
      ).toBeVisible();
    });

    test("keys are ignored while typing in a field", async ({ page }) => {
      await openWorkspace(page);

      await page.keyboard.press("ControlOrMeta+k");
      const input = page.getByPlaceholder(
        /Search commands, pages and projects/u
      );
      await expect(input).toBeFocused();
      await page.keyboard.type("c?g");

      await expect(input).toHaveValue("c?g");
      await expect(
        page.getByRole("dialog", { name: "Keyboard shortcuts" })
      ).toBeHidden();
      await expect(page.getByRole("dialog", { name: "New task" })).toBeHidden();
    });

    test("the palette toggles with the modifier key and shows key hints", async ({
      page,
    }) => {
      await openWorkspace(page);

      await page.keyboard.press("ControlOrMeta+k");
      const palette = page.getByRole("dialog", { name: "Search or jump to" });
      await expect(palette).toBeVisible();
      await expect(
        palette.getByRole("option", { name: /Create task/u })
      ).toContainText("C");
      await expect(
        palette.getByRole("option", { name: /Go to Tasks|^Tasks/u }).first()
      ).toBeVisible();
      await expect(
        palette.getByRole("option", { name: /Invite member/u })
      ).toBeVisible();
      // Task actions need an open task.
      await expect(
        palette.getByRole("option", { name: /Assign task/u })
      ).toHaveCount(0);

      await page.keyboard.press("ControlOrMeta+k");
      await expect(palette).toBeHidden();
    });

    test("Create task in the palette opens the new task dialog", async ({
      page,
    }) => {
      await openWorkspace(page);

      await page.keyboard.press("ControlOrMeta+k");
      await page.getByRole("option", { name: /Create task/u }).click();

      await expect(
        page.getByRole("dialog", { name: "New task" })
      ).toBeVisible();
    });
  });

  test.describe("as an employee", () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
    });

    test("admin-only actions are hidden from the palette", async ({ page }) => {
      await openWorkspace(page);

      await page.keyboard.press("ControlOrMeta+k");
      const palette = page.getByRole("dialog", { name: "Search or jump to" });
      await expect(palette).toBeVisible();
      await expect(
        palette.getByRole("option", { name: /Keyboard shortcuts/u })
      ).toBeVisible();
      await expect(
        palette.getByRole("option", { name: /Invite member/u })
      ).toHaveCount(0);
      await expect(
        palette.getByRole("option", { name: /Create project/u })
      ).toHaveCount(0);
    });
  });
});

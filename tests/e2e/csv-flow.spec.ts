import { readFile, writeFile } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { expect, request, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

const stamp = Date.now().toString(36);
const OPEN_TITLE = `E2E CSV open ${stamp}`;
const FORMULA_TITLE = `=E2E CSV formula ${stamp}`;

const importFile = async (
  testInfo: { outputPath: (name: string) => string },
  name: string,
  text: string
) => {
  const path = testInfo.outputPath(name);
  await writeFile(path, text);
  return path;
};

const openImportDialog = async (page: Page) => {
  await page.goto("/tasks");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Import CSV" }).click();
  await expect(
    page.getByRole("dialog", { name: "Import tasks" })
  ).toBeVisible();
};

// A task that was never imported (a failed run) is simply not there to archive.
const archiveImported = async (page: Page, title: string) => {
  const more = page.getByRole("button", {
    exact: true,
    name: `More actions for ${title}`,
  });
  if ((await more.count()) === 0) {
    return;
  }
  await more.click();
  await page.getByRole("menuitem", { name: "Archive task" }).click();
  await expect(more).toHaveCount(0);
};

const feedUrlFromCard = async (page: Page): Promise<string> => {
  const link = page.getByLabel("Your private feed link");
  await expect(link).toBeVisible();
  return link.inputValue();
};

// A bare client has no cookies, as a calendar app polling the link would.
const feedStatus = async (url: string): Promise<number> => {
  const client = await request.newContext();
  try {
    const response = await client.get(url);
    return response.status();
  } finally {
    await client.dispose();
  }
};

test.describe("CSV import, export and calendar feed", () => {
  test.use({ storageState: ADMIN_STATE });
  test.describe.configure({ mode: "serial" });

  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  // The import leaves real tasks behind; archive them so later specs (the
  // timeline reads the first bar) do not meet them.
  test.afterAll(async ({ browser }) => {
    if (!process.env["E2E_ADMIN_PASSWORD"]) {
      return;
    }
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    try {
      const page = await context.newPage();
      await page.goto(`/tasks?q=${encodeURIComponent(stamp)}`);
      await page.waitForLoadState("networkidle");
      await archiveImported(page, OPEN_TITLE);
      await archiveImported(page, FORMULA_TITLE);
    } finally {
      await context.close();
    }
  });

  test("an invalid file imports nothing and names each problem", async ({
    page,
  }, testInfo) => {
    await openImportDialog(page);
    const path = await importFile(
      testInfo,
      "invalid.csv",
      `title,priority,due_date\n${OPEN_TITLE},high,2026-12-24\nBroken row,huge,2026-02-30\n`
    );
    await page.getByLabel("CSV file").setInputFiles(path);
    await page.getByRole("button", { name: "Import tasks" }).click();

    const alert = page.getByRole("alert").filter({ hasText: "not imported" });
    await expect(alert).toContainText("Row 3, priority");
    await expect(alert).toContainText("Row 3, due_date");

    await page.keyboard.press("Escape");
    await page.goto(`/tasks?q=${encodeURIComponent(OPEN_TITLE)}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(OPEN_TITLE)).toHaveCount(0);
  });

  test("a valid file imports into the chosen project and shows on the tasks page", async ({
    page,
  }, testInfo) => {
    await openImportDialog(page);
    const path = await importFile(
      testInfo,
      "valid.csv",
      `title,status,priority,due_date,description,assignees\n${OPEN_TITLE},todo,high,2026-12-24,"Imported, with a comma",ui-admin@metsys.test\n${FORMULA_TITLE},review,low,,,\n`
    );
    await page.getByLabel("CSV file").setInputFiles(path);
    await page.getByRole("button", { name: "Import tasks" }).click();
    await expect(page.getByText("Imported 2 tasks.")).toBeVisible();

    await page.keyboard.press("Escape");
    await page.goto(`/tasks?q=${encodeURIComponent(stamp)}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(OPEN_TITLE).first()).toBeVisible();
  });

  test("export follows the filters on the page and neutralises formulas", async ({
    page,
  }) => {
    await page.goto(`/tasks?q=${encodeURIComponent(stamp)}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(OPEN_TITLE).first()).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^tasks-\d{4}-\d{2}-\d{2}\.csv$/u);
    const path = await file.path();
    const raw = await readFile(path, "utf-8");
    const text = raw.replace(/^﻿/u, "");

    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe(
      "project,number,title,description,status,priority,start_date,due_date,assignees,created_at"
    );
    expect(text).toContain(OPEN_TITLE);
    expect(text).toContain(`'${FORMULA_TITLE}`);
    expect(text).toContain('"Imported, with a comma"');
    expect(lines).toHaveLength(3);
  });

  test("the calendar feed link works without a session until it is rotated or revoked", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Preferences" }).click();

    const card = page.locator('[data-calendar-feed="true"]');
    const revoke = card.getByRole("button", { name: "Revoke link" });
    if (await revoke.isVisible()) {
      await revoke.click();
      await page.getByRole("button", { name: "Revoke link" }).last().click();
    }
    await card.getByRole("button", { name: "Create feed link" }).click();
    const firstUrl = await feedUrlFromCard(page);
    expect(firstUrl).toMatch(/\/api\/calendar\/[\w-]{32,}\.ics$/u);

    const client = await request.newContext();
    try {
      const response = await client.get(firstUrl);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/calendar");
      const body = await response.text();
      expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
      expect(body).toContain(OPEN_TITLE);
    } finally {
      await client.dispose();
    }

    await card.getByRole("button", { name: "Generate new link" }).click();
    await page
      .getByRole("button", { name: "Generate new link" })
      .last()
      .click();
    await expect(page.getByLabel("Your private feed link")).not.toHaveValue(
      firstUrl
    );
    const secondUrl = await feedUrlFromCard(page);
    expect(await feedStatus(firstUrl)).toBe(404);
    expect(await feedStatus(secondUrl)).toBe(200);

    await card.getByRole("button", { name: "Revoke link" }).click();
    await page.getByRole("button", { name: "Revoke link" }).last().click();
    await expect(
      card.getByRole("button", { name: "Create feed link" })
    ).toBeVisible();
    expect(await feedStatus(secondUrl)).toBe(404);
  });
});

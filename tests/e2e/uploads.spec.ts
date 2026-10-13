import { setTimeout as sleep } from "node:timers/promises";

import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE } from "./auth-state";

test.use({ storageState: ADMIN_STATE });

test.beforeEach(() => {
  test.skip(
    !process.env["E2E_ADMIN_PASSWORD"],
    "E2E_ADMIN_PASSWORD is not set"
  );
});

const openFiles = async (page: Page) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=files`);
  await page.waitForLoadState("networkidle");
};

const choose = (page: Page, name: string, body = "metsys e2e upload") =>
  page.getByLabel("Choose files to upload").setInputFiles({
    buffer: Buffer.from(body),
    mimeType: "text/plain",
    name,
  });

test.describe("project file uploads", () => {
  test("an upload shows in the list, can be renamed, removed and restored", async ({
    page,
  }) => {
    await openFiles(page);
    const stamp = Date.now();
    const name = `e2e-upload-${stamp}.txt`;
    await choose(page, name);

    const card = page.locator("article.file-card", { hasText: name });
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(
      page.getByRole("region", { name: "Uploads" }).getByText("Uploaded")
    ).toBeVisible();

    const renamed = `e2e-renamed-${stamp}.txt`;
    await card.getByRole("button", { name: `Options for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByLabel("File name").fill(renamed);
    await page.getByRole("button", { name: "Save name" }).click();
    const renamedCard = page.locator("article.file-card", {
      hasText: renamed,
    });
    await expect(renamedCard).toBeVisible({ timeout: 15_000 });

    await renamedCard
      .getByRole("button", { name: `Options for ${renamed}` })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(renamedCard).toHaveCount(0, { timeout: 15_000 });
    await page.getByRole("button", { exact: true, name: "Undo" }).click();
    await expect(renamedCard).toBeVisible({ timeout: 15_000 });

    // Leave the fixture project as it was found.
    await renamedCard
      .getByRole("button", { name: `Options for ${renamed}` })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(renamedCard).toHaveCount(0, { timeout: 15_000 });
  });

  test("a storage failure keeps the file listed with Retry, and Retry succeeds", async ({
    page,
  }) => {
    await openFiles(page);
    const name = `e2e-retry-${Date.now()}.txt`;
    let failures = 1;
    await page.route(/\/metsys-[^/]*\/.*[?&]X-Amz-/u, async (route) => {
      if (route.request().method() === "PUT" && failures > 0) {
        failures -= 1;
        await route.fulfill({ status: 500 });
        return;
      }
      await route.continue();
    });
    await choose(page, name);

    const uploads = page.getByRole("region", { name: "Uploads" });
    await expect(uploads.getByText(/Upload failed for/u)).toBeVisible({
      timeout: 30_000,
    });
    await uploads
      .getByRole("button", { name: `Retry upload of ${name}` })
      .click();
    const card = page.locator("article.file-card", { hasText: name });
    await expect(card).toBeVisible({ timeout: 30_000 });

    await card.getByRole("button", { name: `Options for ${name}` }).click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(card).toHaveCount(0, { timeout: 15_000 });
  });

  test("an upload can be cancelled while it is in flight", async ({ page }) => {
    await openFiles(page);
    const name = `e2e-cancel-${Date.now()}.txt`;
    // Hold the storage PUT so the Cancel control stays on screen.
    await page.route(/\/metsys-[^/]*\/.*[?&]X-Amz-/u, async (route) => {
      if (route.request().method() === "PUT") {
        await sleep(10_000);
      }
      await route.abort().catch(() => {});
    });
    await choose(page, name);

    const uploads = page.getByRole("region", { name: "Uploads" });
    await uploads
      .getByRole("button", { name: `Cancel upload of ${name}` })
      .click();
    await expect(uploads.getByText("Cancelled")).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.locator("article.file-card", { hasText: name })
    ).toHaveCount(0);
  });
});

import { execFileSync } from "node:child_process";

import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { config } from "dotenv";

import {
  ADMIN_STATE,
  CLIENT_ONE_STATE,
  CLIENT_TWO_STATE,
  HANDLER_STATE,
  HANDLER_TWO_STATE,
  PORTAL_ACCOUNTS,
} from "./auth-state";
import { settleAnimations } from "./settle-animations";

// The plan's walkthrough, end to end: first sign-in, a report with a
// screenshot, the pick race, an internal note, a needs-info round trip, a
// release, a reopen, a second release, and a confirmation with a rating.
// Needs scripts/seed-e2e-accounts.ts to have run (it resets the accounts).

config({ quiet: true });

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BUG_TITLE = `Invoice export fails ${Date.now()}`;
const INTERNAL_NOTE = `Internal: suspect the nightly export job ${Date.now()}`;
const NEW_PASSWORD = "acme-portal-password-2026!";
// A 1×1 PNG, enough for the upload path to accept as a screenshot.
const SCREENSHOT = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let bugUrl = "";

// Serial and stateful: the first test uses up a temporary password, so a CI
// retry would replay it against an account that has already moved on.
test.describe.configure({ mode: "serial", retries: 0 });

const expectNoViolations = async (page: Page, where: string) => {
  await settleAnimations(page);
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // Name the element and the measured values, so a failure says what to fix.
  const summary = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id}: ${node.target.join(" ")} ${node.failureSummary ?? ""}`
    )
  );
  expect(summary, `axe violations on ${where}`).toEqual([]);
};

const noSidewaysScroll = async (page: Page) => {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
};

const bugIdOf = (url: string): string => url.split("/").at(-1) ?? "";

// Stands in for the internal fix, approval and release pages.
const advanceToRelease = () => {
  const status = execFileSync(
    "bun",
    [
      "--preload",
      "./tests/backend/support/server-only-stub.ts",
      "scripts/e2e-advance-bug.ts",
      BUG_TITLE,
    ],
    {
      encoding: "utf-8",
    }
  ).trim();
  expect(status).toBe("awaiting_client");
};

const statusChip = (page: Page) => page.locator("main header").first();

// Reloads until the bug header shows the label, since the action that
// changes the status may still be finishing when its text first appears.
const expectStatus = async (page: Page, label: string) => {
  await expect(async () => {
    await page.reload();
    await expect(statusChip(page)).toContainText(label, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
};

test.describe("a new client user", () => {
  test.use({
    extraHTTPHeaders: { "x-forwarded-for": "192.0.2.40" },
    storageState: { cookies: [], origins: [] },
  });

  test("signs in, changes the temporary password and reports a bug with a screenshot", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator('form[data-hydrated="true"]')).toBeVisible();
    await page.fill('input[name="email"]', PORTAL_ACCOUNTS.newClient);
    await page.fill(
      'input[name="password"]',
      process.env["E2E_PORTAL_PASSWORD"] ?? ""
    );
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/change-password/u);
    await page
      .getByLabel("Temporary password", { exact: true })
      .fill(process.env["E2E_PORTAL_PASSWORD"] ?? "");
    await page.getByLabel("New password", { exact: true }).fill(NEW_PASSWORD);
    await page
      .getByLabel("Confirm new password", { exact: true })
      .fill(NEW_PASSWORD);
    await page
      .getByRole("button", { name: "Set password and continue" })
      .click();
    await page.waitForURL(/\/portal$/u);

    await page.goto("/portal/new");
    await page
      .getByRole("combobox", { name: "Project" })
      .selectOption({ label: "Acme Web App" });
    await page.getByLabel("Title").fill(BUG_TITLE);
    await page.getByLabel("Expected behavior").fill("A CSV file downloads.");
    await page.getByLabel("Actual behavior").fill("The page shows an error.");
    await page
      .getByRole("textbox", { name: "Step 1" })
      .fill("Open the Invoices page");
    await page.getByLabel("Page URL").fill("https://acme.example/invoices");
    await page.getByRole("radio", { name: /High/u }).check();
    await page.getByLabel("Attach files").setInputFiles({
      buffer: SCREENSHOT,
      mimeType: "image/png",
      name: "export-error.png",
    });
    await page.getByRole("button", { name: /submit|send|report/iu }).click();
    await page.waitForURL(/\/portal\/bugs\//u, { timeout: 60_000 });
    bugUrl = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: BUG_TITLE })).toBeVisible();
    await expect(page.getByText("Submitted").first()).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Attachments" })
        .getByText("export-error.png")
    ).toBeVisible({ timeout: 30_000 });
    await expectNoViolations(page, "bug detail");
    await page.setViewportSize({ height: 700, width: 320 });
    await noSidewaysScroll(page);
  });
});

test.describe("a colleague at the same company", () => {
  test.use({ storageState: CLIENT_TWO_STATE });

  test("sees the bug in the company list", async ({ page }) => {
    await page.goto("/portal");
    await expect(page.getByText(BUG_TITLE)).toBeVisible();
  });
});

test.describe("handler A", () => {
  test.use({ storageState: HANDLER_STATE });

  test("was notified, picks the bug and leaves an internal note", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await expect(page.getByText(BUG_TITLE).first()).toBeVisible();

    const bugId = bugIdOf(bugUrl);
    await page.goto(`/bugs/${bugId}`);
    await page.getByRole("button", { name: "Pick this bug" }).click();
    await expect(page.getByText(/Picked by Hana Handler/u)).toBeVisible();
    await expect(page.getByText(/First response/u).first()).toBeVisible();

    // Comments live in the bug's workflow drawer, opened from the bug list.
    await page.goto("/bugs");
    await page
      .locator("article")
      .filter({ hasText: BUG_TITLE })
      .getByRole("button", { name: "Open workflow" })
      .click();
    await page.getByLabel("Add a comment").fill(INTERNAL_NOTE);
    await expect(
      page.getByRole("radio", { name: "Internal note" })
    ).toBeChecked();
    await page.getByRole("button", { exact: true, name: "Comment" }).click();
    await expect(page.getByText(INTERNAL_NOTE)).toBeVisible();
  });
});

test.describe("handler B", () => {
  test.use({ storageState: HANDLER_TWO_STATE });

  test("was notified too, but can only look once A has picked it", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await expect(page.getByText(BUG_TITLE).first()).toBeVisible();
    await page.goto(`/bugs/${bugIdOf(bugUrl)}`);
    await expect(page.getByText(/Picked by Hana Handler/u)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pick this bug" })
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Ask client" })).toHaveCount(
      0
    );
  });
});

test.describe("handler A asks", () => {
  test.use({ storageState: HANDLER_STATE });

  test("the client a question", async ({ page }) => {
    await page.goto(`/bugs/${bugIdOf(bugUrl)}`);
    const dialog = page.getByRole("dialog");
    const trigger = page.getByRole("button", { name: "Ask client" });
    await expect(async () => {
      if (!(await dialog.isVisible())) {
        await trigger.click();
      }
      await expect(dialog).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 15_000 });
    await dialog
      .getByLabel("Question for the client")
      .fill("Which browser are you using?");
    await dialog.getByRole("button", { name: "Ask client" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Needs info").first()).toBeVisible();
  });
});

test.describe("the colleague answers", () => {
  test.use({ storageState: CLIENT_TWO_STATE });

  test("and the bug goes back to the team", async ({ page }) => {
    await page.goto(bugUrl);
    await expect(
      page.getByRole("blockquote").getByText("Which browser are you using?")
    ).toBeVisible();
    await expect(page.getByText(INTERNAL_NOTE)).toHaveCount(0);
    await expectNoViolations(page, "needs-info banner");
    await page.getByLabel("Your reply").fill("Chrome 130 on Windows.");
    await page.getByRole("button", { name: "Send reply" }).click();
    await expect(
      page.getByText("Chrome 130 on Windows.").first()
    ).toBeVisible();
    await expectStatus(page, "Acknowledged");
  });
});

test.describe("after the first release", () => {
  test.use({ storageState: CLIENT_ONE_STATE });

  test("a client reports it is still broken", async ({ page }) => {
    advanceToRelease();
    await page.goto(bugUrl);
    await expect(
      page.getByRole("heading", { name: /Fix ready/u })
    ).toBeVisible();
    await expectNoViolations(page, "fix-ready banner");
    await page.getByRole("button", { name: "Still broken" }).click();
    await page
      .getByLabel("What is still broken?")
      .fill("Exports with more than 100 rows still fail.");
    await page.getByRole("button", { name: "Send back to the team" }).click();
    await expect(page.getByRole("heading", { name: /Fix ready/u })).toBeHidden({
      timeout: 30_000,
    });
    await expectStatus(page, "Acknowledged");
    await expect(
      page.getByText("Exports with more than 100 rows still fail.").first()
    ).toBeVisible();
  });
});

test.describe("after the second release", () => {
  test.use({ storageState: CLIENT_TWO_STATE });

  test("the colleague confirms the fix and rates it", async ({ page }) => {
    advanceToRelease();
    await page.goto(bugUrl);
    // The click only counts once the page is interactive; pressed proves it.
    const thumbsUp = page.getByRole("button", { name: "Good, thumbs up" });
    await expect(async () => {
      await thumbsUp.click();
      await expect(thumbsUp).toHaveAttribute("aria-pressed", "true", {
        timeout: 1000,
      });
    }).toPass({ timeout: 15_000 });
    await page.getByRole("button", { name: "Confirm it works" }).click();
    // Reloading before the action returns would cancel it; the banner goes
    // once the confirmation is saved. (The button only relabels while busy.)
    await expect(page.getByRole("heading", { name: /Fix ready/u })).toBeHidden({
      timeout: 30_000,
    });
    await expectStatus(page, "Closed");
    await expect(page.getByText(INTERNAL_NOTE)).toHaveCount(0);
    await expectNoViolations(page, "closed bug");
  });
});

test.describe("an admin", () => {
  test.use({ storageState: ADMIN_STATE });

  test("sees the rating, the SLA and the audit trail", async ({ page }) => {
    await page.goto(`/bugs/${bugIdOf(bugUrl)}`);
    await expect(page.getByText(/First response/u).first()).toBeVisible();
    await expect(page.getByText(/1 of 3 times/u).first()).toBeVisible();
    await page.goto("/clients/audit?q=new-client");
    await expect(
      page.getByRole("table").getByText(PORTAL_ACCOUNTS.newClient).first()
    ).toBeVisible();
    await expect(
      page
        .getByRole("table")
        .getByText(/Password changed/u)
        .first()
    ).toBeVisible();
  });
});

test.describe("client one", () => {
  test.use({ storageState: CLIENT_ONE_STATE });

  for (const route of [
    "/portal",
    "/portal/new",
    "/portal/notifications",
    "/portal/account",
  ]) {
    test(`${route} passes axe and fits a phone`, async ({ page }) => {
      await page.setViewportSize({ height: 800, width: 1280 });
      await page.goto(route);
      await expect(page.locator("main h1").first()).toBeVisible();
      await expectNoViolations(page, route);
      await page.setViewportSize({ height: 700, width: 320 });
      await noSidewaysScroll(page);
    });
  }

  test("the account page lists the signed-in devices with a sign-out button", async ({
    page,
  }) => {
    await page.goto("/portal/account");

    await expect(
      page.getByRole("heading", { name: "Signed-in devices" })
    ).toBeVisible();
    // Each device row has its own "Sign out <device>" button; the page's
    // plain "Sign out" button has no device name after it.
    await expect(
      page.getByRole("button", { name: /^Sign out .+/u }).first()
    ).toBeVisible();
  });
});

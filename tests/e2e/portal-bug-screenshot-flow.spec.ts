import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { ADMIN_STATE, CLIENT_ONE_STATE } from "./auth-state";

// A client reports a bug with a captured, annotated screenshot and the
// browser's technical details; staff then read the details as plain text.
// Needs scripts/seed-e2e-accounts.ts to have run (the Acme client and admin).
// Sharing a screen needs a person to pick it, so the specs hand the page a
// canvas-backed stream in place of getDisplayMedia.

const STAMP = Date.now();
const CAPTURED_TITLE = `Screenshot flow ${STAMP}`;
const OPT_OUT_TITLE = `Opt-out flow ${STAMP}`;
const HOSTILE_ALT = `<img src=x onerror=alert(1)> banner ${STAMP}`;

const fakeScreenShare = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  // A canvas stream only emits a frame when the canvas changes, so keep
  // painting it the way a live screen share would.
  const paint = () => {
    if (context) {
      context.fillStyle = "#336699";
      context.fillRect(0, 0, 640, 360);
      context.fillStyle = "#ffffff";
      context.fillRect(40, 40, 200, 80);
    }
  };
  paint();
  setInterval(paint, 100);
  Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
    configurable: true,
    value: () => Promise.resolve(canvas.captureStream(5)),
  });
};

const removeScreenShare = () => {
  Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
    configurable: true,
    value: undefined,
  });
};

const fillReport = async (page: Page, title: string) => {
  await page.goto("/portal/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Expected behavior").fill("The page loads.");
  await page.getByLabel("Actual behavior").fill("The page shows an error.");
  await page
    .getByRole("textbox", { name: "Step 1" })
    .fill("Open the dashboard");
  await page.getByLabel("Page URL").fill("https://acme.example/dashboard");
  await page.getByRole("radio", { name: /High/u }).check();
};

const submitReport = async (page: Page): Promise<string> => {
  await page.getByRole("button", { name: /^(?:submit|send|report)/iu }).click();
  await page.waitForURL(/\/portal\/bugs\//u, { timeout: 60_000 });
  return new URL(page.url()).pathname.split("/").at(-1) ?? "";
};

test.describe.configure({ mode: "serial" });

let capturedBugId = "";
let optOutBugId = "";

test.describe("a client reporting with a screenshot (/portal/new)", () => {
  test.use({ storageState: CLIENT_ONE_STATE });

  test("captures, marks up with the pointer and keyboard, and attaches", async ({
    page,
  }) => {
    await page.addInitScript(fakeScreenShare);
    await fillReport(page, CAPTURED_TITLE);

    await page.getByRole("button", { name: "Capture screenshot" }).click();
    const canvas = page.locator("canvas");
    await expect(canvas).toBeVisible();

    // The pointer draws a rectangle, and Undo takes it back.
    await page.getByRole("button", { name: "Rectangle" }).click();
    await expect(
      page.getByRole("button", { name: "Rectangle" })
    ).toHaveAttribute("aria-pressed", "true");
    const box = await canvas.boundingBox();
    if (!box) {
      throw new Error("The canvas has no box.");
    }
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 120, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByText(/Rectangle added\. 1 mark/u)).toBeAttached();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

    // The keyboard draws an arrow without a pointer.
    await page.getByRole("button", { name: "Arrow" }).click();
    await canvas.focus();
    await page.keyboard.press("Space");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await page.keyboard.press("Space");
    await expect(page.getByText(/Arrow added\. 1 mark/u)).toBeAttached();

    await page.getByLabel(/Describe the screenshot/u).fill(HOSTILE_ALT);
    await page.getByRole("button", { name: "Use screenshot" }).click();
    await expect(
      page.getByRole("list", { name: "Captured screenshot" })
    ).toContainText(/screenshot-\d+\.png/u);

    // The technical details are listed before anything is sent.
    await page.getByText("Technical details we'll send").click();
    await expect(page.getByText("/portal/new").first()).toBeVisible();
    await expect(
      page.getByLabel("Send these technical details with my report")
    ).toBeChecked();

    capturedBugId = await submitReport(page);
    await expect(
      page.getByRole("region", { name: "Attachments" })
    ).toContainText(/screenshot-\d+\.png/u, { timeout: 30_000 });
  });

  test("sends no technical details when the box is cleared", async ({
    page,
  }) => {
    await fillReport(page, OPT_OUT_TITLE);
    await page
      .getByLabel("Send these technical details with my report")
      .uncheck();
    optOutBugId = await submitReport(page);
    expect(optOutBugId).not.toBe("");
  });

  test("explains when the browser cannot capture and still files", async ({
    page,
  }) => {
    await page.addInitScript(removeScreenShare);
    await fillReport(page, `No capture ${STAMP}`);
    await expect(
      page.getByRole("button", { name: "Capture screenshot" })
    ).toHaveCount(0);
    await expect(
      page.getByText(/Capturing a screenshot is not available/u)
    ).toBeVisible();
    await submitReport(page);
  });
});

test.describe("staff reading the report (/bugs/[bugId])", () => {
  test.use({ storageState: ADMIN_STATE });

  test("see the reporter's browser details as plain text", async ({ page }) => {
    await page.goto(`/bugs/${capturedBugId}`);
    const section = page.getByRole("region", { name: "Client report" });
    await expect(section.getByText("Reported browser")).toBeVisible();
    await expect(section.getByText("Reported window size")).toBeVisible();
    await expect(section.getByText("Reported page")).toBeVisible();
    await expect(section.getByText("/portal/new")).toBeVisible();
    // The screenshot's description is text on the page, never markup.
    await expect(page.locator("img[src='x']")).toHaveCount(0);
  });

  test("see no details for a report that opted out", async ({ page }) => {
    await page.goto(`/bugs/${optOutBugId}`);
    await expect(
      page.getByRole("region", { name: "Client report" })
    ).toBeVisible();
    await expect(page.getByText("Reported browser")).toHaveCount(0);
  });
});

import { instant } from "@next/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { CLIENT_ONE_STATE } from "./auth-state";

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

interface Shell {
  readonly loading: string;
  readonly path: string;
}

const expectShellMarker = async (page: Page, path: string) => {
  const marker = path.startsWith("/portal")
    ? page.locator("#portal-main:visible")
    : page.locator("#main-content:visible");
  await expect(marker.first()).toBeVisible();
};

// The portal frame paints before the session check, so an expired saved
// login would still pass the lock and only then redirect to /login.
test.beforeEach(async ({ page }) => {
  const response = await page.request.get(`${BASE_URL}/api/auth/get-session`);
  expect(
    await response.json(),
    "saved login expired; rerun the setup project"
  ).not.toBeNull();
});

const guard = (shells: readonly Shell[]) => {
  for (const { loading, path } of shells) {
    test(`${path} frame and skeleton commit on initial load`, async ({
      page,
    }) => {
      await instant(
        page,
        async () => {
          await page.goto(path);
          await expectShellMarker(page, path);
          await expect(
            page.locator("output", { hasText: loading }).first()
          ).toBeAttached();
        },
        { baseURL: BASE_URL }
      );
      await expect(
        page.locator("output:visible", { hasText: loading })
      ).toHaveCount(0);
    });
  }
};

test.describe("workspace clients", () => {
  guard([
    { loading: "Loading client companies", path: "/clients" },
    { loading: "Loading audit events", path: "/clients/audit" },
  ]);
});

test.describe("client portal", () => {
  test.use({ storageState: CLIENT_ONE_STATE });
  guard([
    { loading: "Loading company bugs", path: "/portal" },
    { loading: "Loading bug form", path: "/portal/new" },
    { loading: "Loading notifications", path: "/portal/notifications" },
    { loading: "Loading account", path: "/portal/account" },
  ]);
});

const detailGuard = (list: string, prefix: string, loading: string) => {
  test(`${prefix}/[id] frame and skeleton commit on initial load`, async ({
    page,
  }) => {
    await page.goto(list);
    const href = await page
      .locator(`a[href^="${prefix}/"]:not([href$="/audit"])`)
      .first()
      .getAttribute("href");
    expect(href).toBeTruthy();
    await instant(
      page,
      async () => {
        await page.goto(href ?? list);
        await expectShellMarker(page, list);
        await expect(
          page.locator("output", { hasText: loading }).first()
        ).toBeAttached();
      },
      { baseURL: BASE_URL }
    );
    await expect(
      page.locator("output:visible", { hasText: loading })
    ).toHaveCount(0);
  });
};

test.describe("record details", () => {
  detailGuard("/clients", "/clients", "Loading client company");
});

test.describe("portal record details", () => {
  test.use({ storageState: CLIENT_ONE_STATE });
  detailGuard("/portal", "/portal/bugs", "Loading bug");
});

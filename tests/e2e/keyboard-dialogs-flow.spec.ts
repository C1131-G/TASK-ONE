import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

// Every layer a trigger can open: dialogs, sheets, menus, popovers and listboxes.
const LAYER =
  '[role="dialog"],[role="alertdialog"],[role="menu"],[data-radix-popper-content-wrapper],[data-slot="popover-content"]';
const TRIGGERS = '[aria-haspopup]:not([aria-haspopup="false"])';

interface Trigger {
  readonly index: number;
  readonly name: string;
}

// One trigger per distinct name, so a table of rows with the same menu is checked once.
const findTriggers = (page: Page): Promise<Trigger[]> =>
  page.evaluate((selector) => {
    const seen = new Set<string>();
    const found: { index: number; name: string }[] = [];
    for (const [index, element] of [
      ...document.querySelectorAll(selector),
    ].entries()) {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      const hidden =
        style.display === "none" ||
        style.visibility === "hidden" ||
        box.width === 0 ||
        element.closest("[hidden],[aria-hidden=true],[inert]");
      if (hidden) {
        continue;
      }
      const name = (
        element.getAttribute("aria-label") ??
        element.textContent ??
        ""
      )
        .trim()
        .replaceAll(/\s+/gu, " ")
        .replaceAll(/\d+/gu, "N")
        .slice(0, 40);
      const key = `${name}|${element.getAttribute("aria-haspopup")}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ index, name });
      }
    }
    return found;
  }, TRIGGERS);

const insideLayer = (page: Page): Promise<boolean> =>
  page.evaluate(
    (selector) => Boolean(document.activeElement?.closest(selector)),
    LAYER
  );

const layerOpen = (page: Page): Promise<boolean> =>
  page.evaluate((selector) => Boolean(document.querySelector(selector)), LAYER);

// Opens one trigger with the keyboard and returns what went wrong, if anything.
const checkTrigger = async (
  page: Page,
  trigger: Trigger
): Promise<string[]> => {
  const problems: string[] = [];
  const handle = page.locator(TRIGGERS).nth(trigger.index);
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(() => layerOpen(page), { timeout: 3000 })
    .toBe(true)
    .catch(() => problems.push("Enter did not open anything"));
  if (problems.length > 0) {
    return problems;
  }
  if (!(await insideLayer(page))) {
    problems.push("focus did not move into the opened layer");
  }
  const isDialog = await page.evaluate(() =>
    Boolean(document.querySelector('[role="dialog"],[role="alertdialog"]'))
  );
  if (isDialog) {
    for (let press = 0; press < 8; press += 1) {
      // Each press depends on where the last one landed.
      // oxlint-disable-next-line no-await-in-loop
      await page.keyboard.press("Tab");
      // oxlint-disable-next-line no-await-in-loop
      if (!(await insideLayer(page))) {
        problems.push("Tab left the dialog");
        break;
      }
    }
  }
  await page.keyboard.press("Escape");
  await expect
    .poll(() => layerOpen(page), { timeout: 3000 })
    .toBe(false)
    .catch(() => problems.push("Escape did not close it"));
  if (problems.length > 0) {
    return problems;
  }
  const restored = await handle.evaluate(
    (element) => element === document.activeElement
  );
  if (!restored) {
    problems.push("focus did not return to the trigger");
  }
  return problems;
};

const checkRoute = async (page: Page, route: string) => {
  await page.goto(route);
  await page.waitForLoadState("networkidle");
  // Streamed sections replace their skeletons after network idle; collect the
  // triggers only once every loading surface has resolved.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect
    .poll(async () => {
      const found = await findTriggers(page);
      return found.length;
    })
    .toBeGreaterThan(0);
  const triggers = await findTriggers(page);
  const problems: string[] = [];
  for (const trigger of triggers) {
    // A clean page for each trigger, so one failure cannot affect the next.
    // oxlint-disable-next-line no-await-in-loop
    await page.goto(route);
    // oxlint-disable-next-line no-await-in-loop
    await page.waitForLoadState("networkidle");
    // oxlint-disable-next-line no-await-in-loop
    for (const problem of await checkTrigger(page, trigger)) {
      problems.push(`"${trigger.name}": ${problem}`);
    }
  }
  expect(problems).toEqual([]);
};

const populatedProject = async (page: Page): Promise<string> => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  return href ?? "";
};

const adminRoutes = [
  "/",
  "/projects",
  "BOARD",
  "TABLE",
  "CALENDAR",
  "TIMELINE",
  "FILES",
  "/tasks",
  "/members",
  "/teams",
  "/settings",
];

test.describe("keyboard use of dialogs, sheets and menus as admin", () => {
  test.use({ storageState: ADMIN_STATE });

  for (const route of adminRoutes) {
    test(`${route}: open with Enter, stay inside, close with Escape, focus returns`, async ({
      page,
    }) => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
      test.setTimeout(240_000);
      let target = route;
      if (/^[A-Z]+$/u.test(route)) {
        const project = await populatedProject(page);
        target = `${project}?view=${route.toLowerCase()}`;
      }
      await checkRoute(page, target);
    });
  }

  test("on a phone: the mobile menu and page menus work from the keyboard", async ({
    page,
  }) => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
    test.setTimeout(240_000);
    await page.setViewportSize({ height: 800, width: 390 });
    await checkRoute(page, "/");
  });
});

test.describe("keyboard use of dialogs, sheets and menus as employee", () => {
  test.use({ storageState: EMPLOYEE_STATE });

  for (const route of ["/", "/projects", "/tasks", "/inbox", "/members"]) {
    test(`${route}: open with Enter, stay inside, close with Escape, focus returns`, async ({
      page,
    }) => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
      test.setTimeout(240_000);
      await checkRoute(page, route);
    });
  }
});

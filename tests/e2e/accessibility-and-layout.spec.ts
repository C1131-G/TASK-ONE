import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { ADMIN_STATE, EMPLOYEE_STATE } from "./auth-state";

const THEMES = ["light", "dark"] as const;

// Widths from the parity checklist, plus the viewports a browser reports at 200%
// zoom on a 1280px and a 1024px window, and at 400% on a 1280px window.
const SIZES = [
  { height: 700, width: 320 },
  { height: 850, width: 430 },
  { height: 900, width: 768 },
  { height: 900, width: 1024 },
  { height: 360, width: 640 },
  { height: 384, width: 512 },
  { height: 256, width: 320 },
] as const;

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

const projectViews = [
  "overview",
  "board",
  "list",
  "table",
  "calendar",
  "timeline",
  "files",
  "activity",
];

const useTheme = async (page: Page, theme: (typeof THEMES)[number]) => {
  await page.emulateMedia({ colorScheme: theme });
  await page.addInitScript((value) => {
    try {
      localStorage.setItem("metsys-system-theme", value);
    } catch {
      // Storage can be unavailable; the media query still picks the theme.
    }
  }, theme);
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

// Loads each route once, then checks WCAG A and AA rules on the desktop and phone
// layouts and looks for sideways scrolling at every size.
const checkRoutes = async (page: Page, routes: readonly string[]) => {
  const problems: string[] = [];
  for (const route of routes) {
    // Routes are checked one after another: each load depends on the last page's state.
    // oxlint-disable-next-line no-await-in-loop
    await page.setViewportSize({ height: 900, width: 1024 });
    // oxlint-disable-next-line no-await-in-loop
    await page.goto(route);
    // oxlint-disable-next-line no-await-in-loop
    await page.waitForLoadState("networkidle");
    for (const width of [1024, 390]) {
      // oxlint-disable-next-line no-await-in-loop
      await page.setViewportSize({ height: 900, width });
      // oxlint-disable-next-line no-await-in-loop
      const result = await new AxeBuilder({ page })
        .withTags(WCAG_TAGS)
        .analyze();
      for (const violation of result.violations) {
        problems.push(
          `${route} @${width}: ${violation.id} (${violation.nodes.length}) ${violation.nodes[0]?.target.join(" ")}`
        );
      }
    }
    for (const size of SIZES) {
      // oxlint-disable-next-line no-await-in-loop
      await page.setViewportSize(size);
      // oxlint-disable-next-line no-await-in-loop
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth
      );
      if (overflow > 0) {
        problems.push(
          `${route} @${size.width}x${size.height}: scrolls sideways by ${overflow}px`
        );
      }
    }
  }
  return problems;
};

const adminRoutes = (project: string) => [
  "/",
  "/overview",
  "/projects",
  ...projectViews.map((view) => `${project}?view=${view}`),
  "/tasks",
  "/my-tasks",
  "/calendar",
  "/timeline",
  "/files",
  "/inbox",
  "/notifications",
  "/favorites",
  "/search?q=task",
  "/activity",
  "/members",
  "/teams",
  "/settings",
  "/archive",
];

const employeeRoutes = [
  "/",
  "/projects",
  "/tasks",
  "/my-tasks",
  "/inbox",
  "/notifications",
  "/members",
  "/settings",
];

for (const theme of THEMES) {
  test.describe(`${theme} theme signed out`, () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(`the sign-in and access pages pass WCAG A and AA and fit every width`, async ({
      page,
    }) => {
      await useTheme(page, theme);
      expect(await checkRoutes(page, ["/login", "/signup"])).toEqual([]);
    });
  });

  test.describe(`${theme} theme as admin`, () => {
    test.use({ storageState: ADMIN_STATE });

    test(`every page passes WCAG A and AA and fits every width`, async ({
      page,
    }) => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
      test.setTimeout(480_000);
      await useTheme(page, theme);
      const project = await populatedProject(page);
      expect(await checkRoutes(page, adminRoutes(project))).toEqual([]);
    });
  });

  test.describe(`${theme} theme as employee`, () => {
    test.use({ storageState: EMPLOYEE_STATE });

    test(`the employee's pages pass WCAG A and AA and fit every width`, async ({
      page,
    }) => {
      test.skip(
        !process.env["E2E_EMPLOYEE_PASSWORD"],
        "E2E_EMPLOYEE_PASSWORD is not set"
      );
      test.setTimeout(300_000);
      await useTheme(page, theme);
      expect(await checkRoutes(page, employeeRoutes)).toEqual([]);
    });
  });
}

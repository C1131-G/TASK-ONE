import { instant } from "@next/playwright";
import { expect as baseExpect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { settleAnimations } from "./settle-animations";

// The shell must appear without waiting for data, but a loaded machine can take
// longer than the default 5 seconds to paint it.
const expect = baseExpect.configure({ timeout: 20_000 });

const BASE_URL = process.env["E2E_BASE_URL"] ?? "http://localhost:3000";

interface RouteShell {
  readonly path: string;
  readonly heading: RegExp | string;
  readonly settledHeading?: RegExp | string;
  readonly loading: string;
  // Sidebar link for the soft navigation; null when the route has none.
  readonly link: RegExp | null;
}

// Routes whose shell is the page title plus a loading region. /overview and
// /tasks have their own specs; detail routes are named by their record.
const ROUTES: readonly RouteShell[] = [
  {
    heading: "Home",
    link: /^Home/u,
    loading: "Loading your tasks",
    path: "/",
    settledHeading: /^Good (?:morning|afternoon|evening), /u,
  },
  {
    heading: "Inbox",
    link: /^Inbox/u,
    loading: "Loading inbox",
    path: "/inbox",
  },
  {
    heading: "My Tasks",
    link: /^My Tasks/u,
    loading: "Loading your tasks",
    path: "/my-tasks",
  },
  {
    heading: "Favorites",
    link: /^Favorites/u,
    loading: "Loading favorite",
    path: "/favorites",
  },
  {
    heading: "Notifications",
    link: /^Notifications/u,
    loading: "Loading notifications",
    path: "/notifications",
  },
  {
    heading: "Projects",
    link: /^Projects/u,
    loading: "Loading projects",
    path: "/projects",
  },
  {
    heading: "Bugs",
    link: /^Bugs/u,
    loading: "Loading bug reports",
    path: "/bugs",
  },
  {
    heading: "Bug approvals",
    link: /^Bug approvals/u,
    loading: "Loading approvals",
    path: "/bug-approvals",
  },
  {
    heading: "Calendar",
    link: /^Calendar/u,
    loading: "Loading calendar",
    path: "/calendar",
  },
  {
    heading: "Timeline",
    link: /^Timeline/u,
    loading: "Loading timeline",
    path: "/timeline",
  },
  {
    heading: "Files",
    link: /^Files/u,
    loading: "Loading project files",
    path: "/files",
  },
  {
    heading: "Members",
    link: /^Members/u,
    loading: "Loading members",
    path: "/members",
  },
  {
    heading: "Activity",
    link: /^Activity/u,
    loading: "Loading activity",
    path: "/activity",
  },
  {
    heading: "Teams",
    link: /^Teams/u,
    loading: "Loading teams",
    path: "/teams",
  },
  {
    heading: "Archive",
    link: /^Archive/u,
    loading: "Loading archived work",
    path: "/archive",
  },
  {
    heading: "Settings",
    link: /^Settings/u,
    loading: "Loading settings",
    path: "/settings",
  },
  { heading: "Search", link: null, loading: "Loading search", path: "/search" },
];

const loadingRegion = (page: Page, route: RouteShell) =>
  page.locator("main output", { hasText: route.loading });

const expectShell = async (page: Page, route: RouteShell) => {
  await expect(
    page.getByRole("heading", { level: 1, name: route.heading })
  ).toBeVisible();
};

const expectSettled = async (page: Page, route: RouteShell) => {
  await expect(loadingRegion(page, route)).toHaveCount(0);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: route.settledHeading ?? route.heading,
    })
  ).toBeVisible();
};

for (const route of ROUTES) {
  test(`${route.path} title and navigation are available on initial load`, async ({
    page,
  }) => {
    await instant(
      page,
      async () => {
        await page.goto(route.path);
        await expectShell(page, route);
        await expect(
          page.getByRole("navigation", { name: "Main" })
        ).toBeVisible();
      },
      { baseURL: BASE_URL }
    );
    await expectSettled(page, route);
  });

  if (route.link) {
    const { link } = route;
    test(`overview to ${route.path} renders the destination instantly`, async ({
      page,
    }) => {
      await page.goto("/overview");
      const trigger = page
        .getByRole("navigation", { name: "Main" })
        .getByRole("link", { name: link });
      await expect(trigger).toBeVisible();

      await instant(page, async () => {
        await trigger.click();
        await expect(page).toHaveURL((url) => url.pathname === route.path);
        await expectShell(page, route);
      });
      await expectSettled(page, route);
    });
  }
}

interface DetailShell {
  readonly list: string;
  readonly loading: string;
}

// Detail titles are the record's name, so the shell is the frame plus a
// loading region; the record is found from its list page.
const DETAIL_ROUTES: readonly DetailShell[] = [
  { list: "/projects", loading: "Loading project" },
  { list: "/bugs", loading: "Loading bug details" },
  { list: "/members", loading: "Loading member profile" },
  { list: "/teams", loading: "Loading team" },
];

const detailTitle = (list: string, lines: readonly string[]): string => {
  if (list === "/bugs") {
    return lines[1] ?? "";
  }
  if (list === "/members") {
    return lines.find((line) => line.length > 1 && !line.includes("@")) ?? "";
  }
  return lines[0] ?? "";
};

const firstRecord = async (
  page: Page,
  list: string
): Promise<{ readonly href: string; readonly title: string }> => {
  await page.goto(list);
  const record = page.locator(`#main-content a[href^="${list}/"]`).first();
  const href = await record.getAttribute("href");
  expect(href).toBeTruthy();
  // Rendered line breaks distinguish a record title from its card metadata.
  // eslint-disable-next-line unicorn/prefer-dom-node-text-content
  const recordText = await record.innerText();
  const lines = recordText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = detailTitle(list, lines);
  expect(title).not.toBe("");
  return { href: href ?? list, title };
};

for (const detail of DETAIL_ROUTES) {
  const loading = (page: Page) =>
    page.locator("main output", { hasText: detail.loading });

  test(`${detail.list}/[id] record is available on initial load`, async ({
    page,
  }) => {
    const record = await firstRecord(page, detail.list);
    await instant(
      page,
      async () => {
        await page.goto(record.href);
        await expect(page.locator("#main-content")).toBeVisible();
        await expect(
          page.getByRole("navigation", { name: "Main" })
        ).toBeVisible();
      },
      { baseURL: BASE_URL }
    );
    await expect(loading(page)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: record.title })
    ).toBeVisible();
  });

  test(`${detail.list} to a record renders the destination instantly`, async ({
    page,
  }) => {
    await page.goto(detail.list);
    const record = page
      .locator(`#main-content a[href^="${detail.list}/"]`)
      .first();
    const href = await record.getAttribute("href");
    // Rendered line breaks distinguish a record title from its card metadata.
    // eslint-disable-next-line unicorn/prefer-dom-node-text-content
    const recordText = await record.innerText();
    const lines = recordText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const title = detailTitle(detail.list, lines);
    await expect(record).toBeVisible();
    // The list page streams its header slots separately; a click during their
    // reveal transition lands on the view-transition overlay, so let it settle.
    await page.waitForLoadState("networkidle");
    await settleAnimations(page);

    await instant(page, async () => {
      await record.click();
      await expect(page).toHaveURL((url) =>
        url.pathname.startsWith(`${detail.list}/`)
      );
      await expect(page.locator("#main-content")).toBeVisible();
    });
    await expect(loading(page)).toHaveCount(0);
    expect(href).toBeTruthy();
    expect(title).not.toBe("");
    await expect(
      page.getByRole("heading", { level: 1, name: title })
    ).toBeVisible();
  });
}

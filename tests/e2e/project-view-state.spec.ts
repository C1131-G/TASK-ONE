import { expect, test } from "@playwright/test";

test.describe("project board view state", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env["E2E_ADMIN_PASSWORD"],
      "E2E_ADMIN_PASSWORD is not set"
    );
  });

  test("board search is kept in the URL and survives a reload", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "ui-admin@metsys.test");
    await page.fill(
      'input[name="password"]',
      process.env["E2E_ADMIN_PASSWORD"] ?? ""
    );
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => url.pathname === "/", {
      timeout: 90_000,
      waitUntil: "commit",
    });

    await page.goto("/projects");
    const projectLink = page
      .getByRole("link", { name: /UI Fixture Populated/u })
      .first();
    const href = await projectLink.getAttribute("href");
    expect(href).toMatch(/^\/projects\//u);
    await page.goto(`${href}?view=board`);

    const search = page.locator("#project-board-search");
    await search.fill("Fixture task 7");
    await expect(page).toHaveURL(/[?&]q=Fixture(?:\+|%20)task(?:\+|%20)7/u);

    await page.reload();
    await expect(page.locator("#project-board-search")).toHaveValue(
      "Fixture task 7"
    );
  });
});

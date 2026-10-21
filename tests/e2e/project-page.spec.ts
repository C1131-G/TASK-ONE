import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const openPopulatedProject = async (page: Page, view: string) => {
  await page.goto("/projects");
  const href = await page
    .getByRole("link", { name: /UI Fixture Populated/u })
    .first()
    .getAttribute("href");
  expect(href).toMatch(/^\/projects\//u);
  await page.goto(`${href}?view=${view}`);
};

test.describe("Project (/projects/[projectId])", () => {
  test.describe("project table and board", () => {
    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("columns can be hidden, sorted and resized, and hidden columns survive a reload", async ({
      page,
    }) => {
      await openPopulatedProject(page, "table");

      await page.getByRole("button", { name: "Columns" }).click();
      await page.getByRole("menuitemcheckbox", { name: "Estimate" }).click();
      await page.keyboard.press("Escape");
      await expect(page).toHaveURL(/[?&]hidden=estimate(?:&|$)/u);
      await expect(
        page.getByRole("columnheader", { name: "Estimate" })
      ).toHaveCount(0);

      await page.reload();
      await page.waitForLoadState("networkidle");
      await expect(
        page.getByRole("columnheader", { name: "Estimate" })
      ).toHaveCount(0);

      const dueHeader = page.getByRole("columnheader", { name: /^Due/u });
      // Retry the click until the page has hydrated and the handler has run.
      await expect(async () => {
        await page.getByRole("button", { name: "Due" }).click();
        await expect(page).toHaveURL(/[?&]sort=due(?:&|$)/u, { timeout: 2000 });
      }).toPass({ timeout: 60_000 });
      await expect(dueHeader).toHaveAttribute("aria-sort", "ascending");

      const resizer = page.getByRole("separator", {
        name: "Resize Priority column",
      });
      const before = Number(await resizer.getAttribute("aria-valuenow"));
      await resizer.focus();
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("ArrowRight");
      await expect(resizer).toHaveAttribute(
        "aria-valuenow",
        String(before + 16)
      );
    });

    test("a card moves within its column with Alt+arrow and the order survives a reload", async ({
      page,
    }) => {
      await openPopulatedProject(page, "board");

      const todoCards = page.locator(
        'section.bcol[aria-label^="To Do"] article.kcard'
      );
      await expect(todoCards.nth(1)).toBeVisible();
      const firstTitle =
        (await todoCards.nth(0).locator(".title").textContent()) ?? "";
      const secondTitle =
        (await todoCards.nth(1).locator(".title").textContent()) ?? "";

      // Keys sent before React hydrates the cards do nothing, so wait for hydration.
      await page.waitForFunction(
        () => {
          const card = document.querySelector("section.bcol article.kcard");
          return (
            card !== null &&
            Object.keys(card).some((key) => key.startsWith("__reactProps"))
          );
        },
        undefined,
        { timeout: 60_000 }
      );
      await todoCards.nth(0).focus();
      await page.keyboard.press("Alt+ArrowDown");
      await expect(
        page
          .locator('[aria-live="polite"]')
          .filter({ hasText: "moved to position 2" })
      ).toBeVisible({
        timeout: 60_000,
      });

      await page.reload();
      await page.waitForLoadState("networkidle");
      const reloaded = page.locator(
        'section.bcol[aria-label^="To Do"] article.kcard'
      );
      await expect(reloaded.nth(0).locator(".title")).toHaveText(secondTitle, {
        timeout: 60_000,
      });
      await expect(reloaded.nth(1).locator(".title")).toHaveText(firstTitle);
    });
  });

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

  test.describe("project budget", () => {
    test.beforeEach(() => {
      test.skip(
        !process.env["E2E_ADMIN_PASSWORD"],
        "E2E_ADMIN_PASSWORD is not set"
      );
    });

    test("an administrator sets a budget, sees its burn on the overview and the time report, then removes it", async ({
      page,
    }) => {
      await openPopulatedProject(page, "overview");
      const budget = page.getByRole("region", { name: "Budget" });
      await expect(budget).toBeVisible({ timeout: 15_000 });

      // Retry until the page has hydrated and the dialog opens.
      await expect(async () => {
        await budget.getByRole("button", { name: /budget/iu }).click();
        await expect(page.getByLabel("Budget (hours)")).toBeVisible({
          timeout: 2000,
        });
      }).toPass({ timeout: 60_000 });
      await page.getByLabel("Budget (hours)").fill("40");
      await page.getByLabel("Warn at (%)").fill("75");
      await page.getByRole("button", { name: "Save budget" }).click();

      await expect(budget.getByRole("progressbar")).toBeVisible();
      await expect(budget.getByText("of 40h")).toBeVisible();
      await expect(budget.getByText("On track")).toBeVisible();

      await page.goto(page.url().replace(/\?.*$/u, "/time"));
      const reportBudget = page.getByRole("region", { name: "Budget" });
      await expect(reportBudget.getByText("of 40h")).toBeVisible({
        timeout: 15_000,
      });

      await page.goto("/budgets");
      await expect(
        page.getByRole("link", { name: /UI Fixture Populated/u })
      ).toBeVisible();

      await page.goBack();
      await page.goBack();
      await expect(async () => {
        await page
          .getByRole("region", { name: "Budget" })
          .getByRole("button", { name: "Edit budget" })
          .click();
        await expect(
          page.getByRole("button", { name: "Remove budget" })
        ).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 60_000 });
      await page.getByRole("button", { name: "Remove budget" }).click();
      await expect(
        page.getByText("No hours budget has been set for this project.")
      ).toBeVisible();
    });
  });
});

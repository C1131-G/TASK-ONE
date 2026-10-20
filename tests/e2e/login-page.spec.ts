import { expect, test } from "@playwright/test";

test.describe("Sign in (/login)", () => {
  // Auth pages are for signed-out visitors, so these specs start without a session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a direct visit to sign in shows the card heading and then the form", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("moving between sign in and request access keeps the shared shell", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Work email")).toBeVisible();
    await page.locator(".auth-app").evaluate((shell) => {
      shell.dataset["persisted"] = "yes";
    });

    await page
      .getByRole("banner")
      .getByRole("link", { name: "Request access" })
      .click();
    await page.waitForURL("**/signup");

    await expect(
      page
        .getByRole("heading", { name: "Request access" })
        .filter({ visible: true })
    ).toBeVisible();
    await expect(page.locator(".auth-app")).toHaveAttribute(
      "data-persisted",
      "yes"
    );
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" })
    ).toBeVisible();
  });

  test("the sign-in page fits a desktop viewport without scrolling", async ({
    page,
  }) => {
    await page.setViewportSize({ height: 620, width: 1280 });
    await page.goto("/login");
    await expect(page.getByLabel("Work email")).toBeVisible();

    const overflow = await page.evaluate(() => ({
      horizontal:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
      vertical:
        document.documentElement.scrollHeight >
        document.documentElement.clientHeight,
    }));
    expect(overflow).toEqual({ horizontal: false, vertical: false });
  });
});

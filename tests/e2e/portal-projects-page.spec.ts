import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";

import { ADMIN_STATE, CLIENT_ONE_STATE } from "./auth-state";

// Needs scripts/seed-e2e-accounts.ts to have run: the Acme company, its client
// users and the admin account. This spec adds its own project to Acme.

config({ quiet: true });

const PROJECT_KEY = "E2EPP";
const PROJECT_NAME = "E2E Shared Project";
const SHARED_TASK = "E2E task shown to the client";
const HIDDEN_TASK = "E2E task kept internal";
const INTERNAL_NOTE = "E2E internal note that clients must never read";

const databaseUrl = process.env["DATABASE_URL"];

interface Seeded {
  readonly hiddenTaskId: string;
  readonly projectId: string;
  readonly sharedTaskId: string;
}

// Rebuilds the project from scratch, so every run starts unshared.
const seedProject = async (): Promise<Seeded> => {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    const company = await pool.query<{ id: string }>(
      "SELECT id FROM client_company WHERE name = 'Acme'"
    );
    const admin = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE "emailNormalized" = 'ui-admin@taskora.test'`
    );
    const companyId = company.rows[0]?.id;
    const adminId = admin.rows[0]?.id;
    if (!(companyId && adminId)) {
      throw new Error("Run scripts/seed-e2e-accounts.ts first.");
    }
    await pool.query(
      `DELETE FROM client_company_project WHERE "projectId" IN (SELECT id FROM project WHERE key = $1)`,
      [PROJECT_KEY]
    );
    await pool.query(
      `DELETE FROM task WHERE "projectId" IN (SELECT id FROM project WHERE key = $1)`,
      [PROJECT_KEY]
    );
    await pool.query("DELETE FROM project WHERE key = $1", [PROJECT_KEY]);
    const seeded: Seeded = {
      hiddenTaskId: randomUUID(),
      projectId: randomUUID(),
      sharedTaskId: randomUUID(),
    };
    await pool.query(
      `INSERT INTO project (id, key, name, description) VALUES ($1, $2, $3, 'Shared with Acme')`,
      [seeded.projectId, PROJECT_KEY, PROJECT_NAME]
    );
    await pool.query(
      `INSERT INTO project_task_counter ("projectId", "nextNumber", "updatedAt") VALUES ($1, 3, now())`,
      [seeded.projectId]
    );
    await pool.query(
      `INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)`,
      [randomUUID(), companyId, seeded.projectId]
    );
    await pool.query(
      `INSERT INTO task (id, "projectId", "projectTaskNumber", title, "createdById") VALUES ($1, $2, 1, $3, $5), ($4, $2, 2, $6, $5)`,
      [
        seeded.sharedTaskId,
        seeded.projectId,
        SHARED_TASK,
        seeded.hiddenTaskId,
        adminId,
        HIDDEN_TASK,
      ]
    );
    await pool.query(
      `INSERT INTO comment (id, "taskId", "authorId", body, visibility) VALUES ($1, $2, $3, $4, 'internal')`,
      [randomUUID(), seeded.sharedTaskId, adminId, INTERNAL_NOTE]
    );
    await pool.query(
      `INSERT INTO project_milestone (id, "projectId", name, "dueDate", position) VALUES ($1, $2, 'E2E launch', '2099-01-31', 0)`,
      [randomUUID(), seeded.projectId]
    );
    return seeded;
  } finally {
    await pool.end();
  }
};

const clientPage = async (browser: Browser) => {
  const context = await browser.newContext({ storageState: CLIENT_ONE_STATE });
  return { context, page: await context.newPage() };
};

test.describe("Portal projects (/portal/projects)", () => {
  test.describe.configure({ mode: "serial" });
  let seeded: Seeded;

  test.beforeAll(async () => {
    test.skip(
      !(
        process.env["E2E_ADMIN_PASSWORD"] && process.env["E2E_PORTAL_PASSWORD"]
      ),
      "E2E_ADMIN_PASSWORD and E2E_PORTAL_PASSWORD are not set"
    );
    seeded = await seedProject();
  });

  test("a project assigned to the company stays hidden until an admin shares it", async ({
    browser,
  }) => {
    const { context, page } = await clientPage(browser);
    await page.goto("/portal/projects");
    await expect(
      page.getByRole("heading", { level: 1, name: "Projects" })
    ).toBeVisible();
    await expect(page.getByText(PROJECT_NAME)).toHaveCount(0);
    await page.goto(`/portal/projects/${seeded.projectId}`);
    await expect(
      page.getByRole("heading", { name: "Project not found" })
    ).toBeVisible();
    await context.close();
  });

  test("an admin shares the project and one task from the workspace", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto(`/projects/${seeded.projectId}`);
    const share = page.getByRole("checkbox", { name: "Visible to client" });
    await expect(async () => {
      await share.click();
      await expect(share).toBeChecked({ timeout: 2000 });
    }).toPass({ timeout: 60_000 });
    // The box is disabled while the action runs; reload only once it saved.
    await expect(share).toBeEnabled({ timeout: 30_000 });
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "Visible to client" })
    ).toBeChecked();

    await page.goto(
      `/projects/${seeded.projectId}?task=${seeded.sharedTaskId}`
    );
    const showTask = page.getByRole("checkbox", { name: "Show to client" });
    await expect(showTask).toBeVisible({ timeout: 60_000 });
    await expect(async () => {
      await showTask.click();
      await expect(showTask).toBeChecked({ timeout: 2000 });
    }).toPass({ timeout: 60_000 });
    await expect(showTask).toBeEnabled({ timeout: 30_000 });
    await context.close();
  });

  test("the client sees progress, milestones and only the shared task", async ({
    browser,
  }) => {
    const { context, page } = await clientPage(browser);
    await page.goto("/portal/projects");
    const card = page.getByRole("link", {
      name: new RegExp(PROJECT_NAME, "u"),
    });
    await expect(card).toBeVisible();
    await expect(card).toContainText("0 of 1 tasks done");
    await expect(card).toContainText("E2E launch");

    await card.click();
    await expect(
      page.getByRole("heading", { level: 1, name: PROJECT_NAME })
    ).toBeVisible();
    await expect(page.getByText(SHARED_TASK)).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: "Milestones" })
    ).toContainText("E2E launch");
    await expect(page.getByText(HIDDEN_TASK)).toHaveCount(0);
    await expect(page.getByText(INTERNAL_NOTE)).toHaveCount(0);
    await context.close();
  });

  test("unsharing the project hides it from the client again", async ({
    browser,
  }) => {
    const admin = await browser.newContext({ storageState: ADMIN_STATE });
    const adminPage = await admin.newPage();
    await adminPage.goto(`/projects/${seeded.projectId}`);
    const share = adminPage.getByRole("checkbox", {
      name: "Visible to client",
    });
    await expect(share).toBeChecked({ timeout: 60_000 });
    await expect(async () => {
      await share.click();
      await expect(share).not.toBeChecked({ timeout: 2000 });
    }).toPass({ timeout: 60_000 });
    await expect(share).toBeEnabled({ timeout: 30_000 });
    await admin.close();

    const { context, page } = await clientPage(browser);
    await page.goto(`/portal/projects/${seeded.projectId}`);
    await expect(
      page.getByRole("heading", { name: "Project not found" })
    ).toBeVisible();
    await context.close();
  });
});

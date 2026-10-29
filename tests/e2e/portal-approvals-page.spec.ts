import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";
import type { Browser } from "@playwright/test";
import { config } from "dotenv";
import { Pool } from "pg";

import { ADMIN_STATE, CLIENT_ONE_STATE } from "./auth-state";

// Needs scripts/seed-e2e-accounts.ts to have run: the Acme company, its client
// users and the admin account. This spec adds its own shared project, task,
// file and approval request to Acme. The signed file download needs object
// storage, so this spec checks what the page lists and leaves the link out.

config({ quiet: true });

const PROJECT_KEY = "E2EAP";
const PROJECT_NAME = "E2E Approvals Project";
const TASK_TITLE = "E2E logo concepts";
const FILE_NAME = "e2e-logo-concepts.pdf";
const INTERNAL_FILE_NAME = "e2e-internal-costing.pdf";
const MESSAGE = "E2E please review the logo concepts";
const CHANGE_NOTE = "E2E make the mark larger";

const databaseUrl = process.env["DATABASE_URL"];

interface Seeded {
  readonly projectId: string;
  readonly requestId: string;
  readonly taskId: string;
}

// Rebuilds the project from scratch, so every run starts with one waiting
// request.
const seedApproval = async (): Promise<Seeded> => {
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
    const old = `(SELECT id FROM project WHERE key = $1)`;
    await pool.query(
      `DELETE FROM approval_request WHERE "projectId" IN ${old}`,
      [PROJECT_KEY]
    );
    await pool.query(
      `DELETE FROM client_company_project WHERE "projectId" IN ${old}`,
      [PROJECT_KEY]
    );
    await pool.query(`DELETE FROM file_asset WHERE "projectId" IN ${old}`, [
      PROJECT_KEY,
    ]);
    await pool.query(`DELETE FROM task WHERE "projectId" IN ${old}`, [
      PROJECT_KEY,
    ]);
    await pool.query("DELETE FROM project WHERE key = $1", [PROJECT_KEY]);
    const seeded: Seeded = {
      projectId: randomUUID(),
      requestId: randomUUID(),
      taskId: randomUUID(),
    };
    const fileId = randomUUID();
    await pool.query(
      `INSERT INTO project (id, key, name, "clientVisible") VALUES ($1, $2, $3, true)`,
      [seeded.projectId, PROJECT_KEY, PROJECT_NAME]
    );
    await pool.query(
      `INSERT INTO project_task_counter ("projectId", "nextNumber", "updatedAt") VALUES ($1, 2, now())`,
      [seeded.projectId]
    );
    await pool.query(
      `INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)`,
      [randomUUID(), companyId, seeded.projectId]
    );
    await pool.query(
      `INSERT INTO task (id, "projectId", "projectTaskNumber", title, "clientVisible", "createdById") VALUES ($1, $2, 1, $3, true, $4)`,
      [seeded.taskId, seeded.projectId, TASK_TITLE, adminId]
    );
    await pool.query(
      `INSERT INTO file_asset (id, "projectId", "taskId", "uploadedById", "originalName", "storageKey", "contentType", "sizeBytes") VALUES ($1, $2, $3, $4, $5, $6, 'application/pdf', 1024), ($7, $2, $3, $4, $8, $9, 'application/pdf', 1024)`,
      [
        fileId,
        seeded.projectId,
        seeded.taskId,
        adminId,
        FILE_NAME,
        `e2e/${fileId}/concepts.pdf`,
        randomUUID(),
        INTERNAL_FILE_NAME,
        `e2e/${randomUUID()}/costing.pdf`,
      ]
    );
    await pool.query(
      `INSERT INTO approval_request (id, "projectId", "companyId", "taskId", "subjectKey", "subjectTitle", version, message, "requestedById") VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8)`,
      [
        seeded.requestId,
        seeded.projectId,
        companyId,
        seeded.taskId,
        `task:${seeded.taskId}`,
        TASK_TITLE,
        MESSAGE,
        adminId,
      ]
    );
    await pool.query(
      `INSERT INTO approval_request_file (id, "requestId", "fileId") VALUES ($1, $2, $3)`,
      [randomUUID(), seeded.requestId, fileId]
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

test.describe("Portal approvals (/portal/approvals)", () => {
  test.describe.configure({ mode: "serial" });
  let seeded: Seeded;

  test.beforeAll(async () => {
    test.skip(
      !(
        process.env["E2E_ADMIN_PASSWORD"] && process.env["E2E_PORTAL_PASSWORD"]
      ),
      "E2E_ADMIN_PASSWORD and E2E_PORTAL_PASSWORD are not set"
    );
    seeded = await seedApproval();
  });

  test("the client sees the waiting request with only its own files", async ({
    browser,
  }) => {
    const { context, page } = await clientPage(browser);
    await page.goto("/portal/approvals");
    await expect(
      page.getByRole("heading", { level: 1, name: "Approvals" })
    ).toBeVisible();
    const card = page.getByRole("link", { name: new RegExp(TASK_TITLE, "u") });
    await expect(card).toContainText("Needs your review");
    await card.click();
    await expect(
      page.getByRole("heading", { level: 1, name: TASK_TITLE })
    ).toBeVisible();
    await expect(page.getByText(MESSAGE)).toBeVisible();
    await expect(page.getByText(FILE_NAME)).toBeVisible();
    await expect(page.getByText(INTERNAL_FILE_NAME)).toHaveCount(0);
    await context.close();
  });

  test("changes cannot be requested without a comment, and the decision then sticks", async ({
    browser,
  }) => {
    const { context, page } = await clientPage(browser);
    await page.goto(`/portal/approvals/${seeded.requestId}`);
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "what needs to change" })
    ).toBeVisible();
    await page.getByLabel(/^Comment/u).fill(CHANGE_NOTE);
    await page.getByRole("button", { name: "Request changes" }).click();
    await expect(page.getByRole("heading", { name: "Outcome" })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(CHANGE_NOTE)).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await context.close();
  });

  test("the team sees the decision in the task's approval history", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: ADMIN_STATE });
    const page = await context.newPage();
    await page.goto(`/projects/${seeded.projectId}?task=${seeded.taskId}`);
    const history = page.getByRole("region", { name: "Client approval" });
    await expect(history).toBeVisible({ timeout: 60_000 });
    await expect(history).toContainText("Changes requested");
    await expect(history).toContainText(CHANGE_NOTE);
    await context.close();
  });
});

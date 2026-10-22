import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const actions =
  await import("../../features/custom-fields/custom-field-actions");
const valueActions =
  await import("../../features/custom-fields/custom-field-value-actions");
const queries =
  await import("../../features/custom-fields/custom-field-queries");
const portalBugActions =
  await import("../../features/portal/portal-bug-actions");
const portalQueries = await import("../../features/portal/portal-queries");

const SECRET_NAME = "Internal margin tier";
const SECRET_VALUE = "SECRET-TIER-42";
let fieldId = "";
let bugId = "";
let bugTaskId = "";

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'UPDATE project SET "clientVisible" = true WHERE id = $1',
    [ids.projectId]
  );
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
  await authPool.query('UPDATE task SET "clientVisible" = true WHERE id = $1', [
    ids.taskId,
  ]);
  const created = await callAs("admin", actions.createCustomFieldAction, {
    idempotencyKey: nextKey(),
    name: SECRET_NAME,
    options: [],
    projectId: ids.projectId,
    required: false,
    type: "text",
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  fieldId = created.data.id;
  const set = await callAs("owner", valueActions.setCustomFieldValueAction, {
    fieldId,
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
    value: SECRET_VALUE,
  });
  if (!set.ok) {
    throw new Error(set.error.message);
  }
  const submitted = await callAs(
    "client",
    portalBugActions.submitClientBugAction,
    {
      actualBehavior: "Broken",
      browser: null,
      description: null,
      device: null,
      expectedBehavior: "Works",
      idempotencyKey: nextKey(),
      impact: "medium",
      os: null,
      pageUrl: "/page",
      projectId: ids.projectId,
      reproductionSteps: ["Open it"],
      title: "Custom field leak probe",
    }
  );
  if (!submitted.ok) {
    throw new Error(submitted.error.message);
  }
  ({ bugId } = submitted.data as { bugId: string });
  const bug = await authPool.query<{ taskId: string }>(
    'SELECT "taskId" FROM bug_report WHERE id = $1',
    [bugId]
  );
  bugTaskId = bug.rows[0]?.taskId ?? "";
});
afterAll(teardownHarness);

const leaks = (payload: unknown): boolean => {
  const text = JSON.stringify(payload);
  return text.includes(SECRET_NAME) || text.includes(SECRET_VALUE);
};

it("keeps custom fields out of every client-facing read", async () => {
  const reads = [
    await callAs("client", portalQueries.listPortalProjects, {}),
    await callAs("client", portalQueries.listPortalSharedProjects, {}),
    await callAs("client", portalQueries.getPortalSharedProject, {
      projectId: ids.projectId,
    }),
    await callAs("client", portalQueries.listPortalBugs, {}),
    await callAs("client", portalQueries.getPortalBug, { bugId }),
  ];
  for (const read of reads) {
    expect(read.ok).toBe(true);
    expect(leaks(read)).toBe(false);
  }
  const project = await callAs("client", portalQueries.getPortalSharedProject, {
    projectId: ids.projectId,
  });
  expect(JSON.stringify(project)).toContain("Owned task");
});

it("refuses a client every custom field read and write", async () => {
  const results = [
    await callAs("client", queries.getTaskCustomFields, { taskId: ids.taskId }),
    await callAs("client", queries.listProjectCustomFields, {
      projectId: ids.projectId,
    }),
    await callAs("client", valueActions.setCustomFieldValueAction, {
      fieldId,
      idempotencyKey: nextKey(),
      taskId: ids.taskId,
      value: "client edit",
    }),
    await callAs("client", valueActions.clearCustomFieldValueAction, {
      fieldId,
      idempotencyKey: nextKey(),
      taskId: ids.taskId,
    }),
    await callAs("client", actions.createCustomFieldAction, {
      idempotencyKey: nextKey(),
      name: "Client field",
      options: [],
      projectId: ids.projectId,
      required: false,
      type: "text",
    }),
  ];
  for (const result of results) {
    expect(result).toMatchObject({ ok: false });
    expect(leaks(result)).toBe(false);
  }
  const stored = await authPool.query(
    'SELECT "textValue" FROM custom_field_value WHERE "taskId" = $1 AND "fieldId" = $2',
    [ids.taskId, fieldId]
  );
  expect(stored.rows[0]?.textValue).toBe(SECRET_VALUE);
});

it("keeps fields off bug tasks, for staff as well", async () => {
  expect(bugTaskId).not.toBe("");
  const set = await callAs("admin", valueActions.setCustomFieldValueAction, {
    fieldId,
    idempotencyKey: nextKey(),
    taskId: bugTaskId,
    value: "on a bug",
  });
  expect(set).toMatchObject({ ok: false });
  const read = await callAs("admin", queries.getTaskCustomFields, {
    taskId: bugTaskId,
  });
  expect(read).toMatchObject({ error: { code: "NOT_FOUND" }, ok: false });
});

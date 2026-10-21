import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  replay,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";
import { refreshes, revalidatedPaths } from "./support/next-cache-mock";

const intake = await import("../../features/intake/intake-actions");
const intakeQueries = await import("../../features/intake/intake-queries");

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    'INSERT INTO client_company_project (id, "companyId", "projectId") VALUES ($1, $2, $3)',
    [randomUUID(), ids.clientCompanyId, ids.projectId]
  );
});
afterAll(async () => {
  await authPool.query('DELETE FROM intake_form WHERE "clientCompanyId" = $1', [
    ids.clientCompanyId,
  ]);
  await teardownHarness();
});

const formCount = async (): Promise<number> => {
  const rows = await authPool.query(
    'SELECT count(*)::int AS count FROM intake_form WHERE "clientCompanyId" = $1',
    [ids.clientCompanyId]
  );
  return rows.rows[0]?.count ?? 0;
};

it("replays every intake form mutation exactly once and asks the page to refresh", async () => {
  const refreshesBefore = refreshes.count;
  const created = await replay(
    "createIntakeFormAction",
    "admin",
    intake.createIntakeFormAction,
    {
      clientCompanyId: ids.clientCompanyId,
      name: "Replay form",
      projectId: ids.projectId,
    }
  );
  expect(await formCount()).toBe(1);
  expect(refreshes.count).toBeGreaterThan(refreshesBefore);
  expect(revalidatedPaths).toContain("/settings");

  const rotated = await replay(
    "rotateIntakeFormAction",
    "admin",
    intake.rotateIntakeFormAction,
    { expectedVersion: created.version, formId: created.formId }
  );
  expect(rotated.version).toBe(created.version + 1);
  expect(rotated.slug).not.toBe(created.slug);

  const disabled = await replay(
    "setIntakeFormEnabledAction",
    "admin",
    intake.setIntakeFormEnabledAction,
    {
      enabled: false,
      expectedVersion: rotated.version,
      formId: created.formId,
    }
  );
  expect(disabled.version).toBe(rotated.version + 1);

  const listed = await callAs("admin", intakeQueries.listIntakeForms, {});
  expect(listed.ok).toBe(true);
  expect(
    listed.ok &&
      listed.data.some(
        (form: { id: string; enabled: boolean }) =>
          form.id === created.formId && !form.enabled
      )
  ).toBe(true);
});

it("reports a stale version as a field-free conflict", async () => {
  const created = await replay(
    "createIntakeFormAction",
    "admin",
    intake.createIntakeFormAction,
    {
      clientCompanyId: ids.clientCompanyId,
      name: "Conflict form",
      projectId: ids.projectId,
    }
  );
  const stale = await callAs("admin", intake.rotateIntakeFormAction, {
    expectedVersion: created.version + 5,
    formId: created.formId,
    idempotencyKey: nextKey(),
  });
  expect(stale.ok).toBe(false);
  expect(!stale.ok && stale.error.code).toBe("CONFLICT");
});

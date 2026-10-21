import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import { Effect, Exit } from "effect";

import type { AppError } from "../../src/server/core/action-result";
import {
  IntakeFormManagement,
  IntakeFormManagementLive,
} from "../../src/server/intake/intake-forms";
import {
  authPool,
  ids,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const run = <Value>(
  program: (
    service: typeof IntakeFormManagement.Service
  ) => Effect.Effect<Value, AppError>
) =>
  Effect.runPromiseExit(
    Effect.provide(
      Effect.gen(function* withService() {
        return yield* program(yield* IntakeFormManagement);
      }),
      IntakeFormManagementLive
    )
  );

const failureCode = (exit: Exit.Exit<unknown, AppError>): string => {
  if (Exit.isSuccess(exit)) {
    return "success";
  }
  const reason = exit.cause.reasons.find((item) => item._tag === "Fail");
  return reason && reason._tag === "Fail" ? reason.error.code : "defect";
};

const value = <Result>(exit: Exit.Exit<Result, AppError>): Result => {
  if (!Exit.isSuccess(exit)) {
    throw new Error(`Expected success but got ${failureCode(exit)}`);
  }
  return exit.value;
};

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

const adminId = () => personaId("admin");
const input = (overrides: Record<string, unknown> = {}) => ({
  clientCompanyId: ids.clientCompanyId,
  name: "Support form",
  projectId: ids.projectId,
  ...overrides,
});

it("lets an admin create a form with a long random public slug", async () => {
  const first = value(
    await run((service) => service.create(adminId(), input()))
  );
  const second = value(
    await run((service) => service.create(adminId(), input()))
  );
  expect(first.slug).toMatch(/^[A-Za-z0-9_-]{22,}$/u);
  expect(second.slug).not.toBe(first.slug);
  const forms = value(await run((service) => service.list(adminId())));
  const listed = forms.find(({ id }) => id === first.formId);
  expect(listed).toMatchObject({
    companyName: expect.stringContaining("Harness client"),
    enabled: true,
    name: "Support form",
    projectName: "Harness project",
    slug: first.slug,
    submissionCount: 0,
  });
});

it("refuses every operation for a non-admin", async () => {
  const created = value(
    await run((service) => service.create(adminId(), input()))
  );
  const employee = personaId("owner");
  const codes = [
    await run((service) => service.list(employee)),
    await run((service) => service.create(employee, input())),
    await run((service) =>
      service.rotate(employee, { expectedVersion: 1, formId: created.formId })
    ),
    await run((service) =>
      service.setEnabled(employee, {
        enabled: false,
        expectedVersion: 1,
        formId: created.formId,
      })
    ),
  ].map(failureCode);
  expect(codes).toEqual(["FORBIDDEN", "FORBIDDEN", "FORBIDDEN", "FORBIDDEN"]);
});

it("only creates forms for a project the company can see", async () => {
  const other = await run((service) =>
    service.create(
      adminId(),
      input({ clientCompanyId: ids.otherClientCompanyId })
    )
  );
  expect(failureCode(other)).toBe("VALIDATION_FAILED");
  const archived = await run((service) =>
    service.create(adminId(), input({ projectId: ids.archivedProjectId }))
  );
  expect(failureCode(archived)).toBe("VALIDATION_FAILED");
  const blank = await run((service) =>
    service.create(adminId(), input({ name: "  " }))
  );
  expect(failureCode(blank)).toBe("VALIDATION_FAILED");
});

it("rotates the slug so the old link stops resolving", async () => {
  const created = value(
    await run((service) => service.create(adminId(), input()))
  );
  const rotated = value(
    await run((service) =>
      service.rotate(adminId(), { expectedVersion: 1, formId: created.formId })
    )
  );
  expect(rotated.slug).not.toBe(created.slug);
  expect(rotated.version).toBe(2);
  const old = await authPool.query(
    "SELECT 1 FROM intake_form WHERE slug = $1",
    [created.slug]
  );
  expect(old.rowCount).toBe(0);
  const stale = await run((service) =>
    service.rotate(adminId(), { expectedVersion: 1, formId: created.formId })
  );
  expect(failureCode(stale)).toBe("CONFLICT");
});

it("disables and re-enables a form with optimistic versioning", async () => {
  const created = value(
    await run((service) => service.create(adminId(), input()))
  );
  const off = value(
    await run((service) =>
      service.setEnabled(adminId(), {
        enabled: false,
        expectedVersion: 1,
        formId: created.formId,
      })
    )
  );
  const row = await authPool.query(
    "SELECT enabled FROM intake_form WHERE id = $1",
    [created.formId]
  );
  expect(row.rows[0].enabled).toBe(false);
  const on = value(
    await run((service) =>
      service.setEnabled(adminId(), {
        enabled: true,
        expectedVersion: off.version,
        formId: created.formId,
      })
    )
  );
  expect(on.version).toBe(3);
  const stale = await run((service) =>
    service.setEnabled(adminId(), {
      enabled: false,
      expectedVersion: 1,
      formId: created.formId,
    })
  );
  expect(failureCode(stale)).toBe("CONFLICT");
  const missing = await run((service) =>
    service.setEnabled(adminId(), {
      enabled: false,
      expectedVersion: 1,
      formId: randomUUID(),
    })
  );
  expect(failureCode(missing)).toBe("NOT_FOUND");
});

import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
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

const fieldIds: Record<string, string> = {};

const defineField = async (
  name: string,
  type: string,
  options: string[] = []
) => {
  const created = await callAs("admin", actions.createCustomFieldAction, {
    idempotencyKey: nextKey(),
    name,
    options,
    projectId: ids.projectId,
    required: false,
    type,
  });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  fieldIds[name] = created.data.id;
};

const setValue = async (name: string, value: unknown, taskId = ids.taskId) => {
  const result = await callAs("owner", valueActions.setCustomFieldValueAction, {
    fieldId: fieldIds[name],
    idempotencyKey: nextKey(),
    taskId,
    value,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
};

const readTable = (
  persona: "owner" | "admin" | "client",
  projectId = ids.projectId
) => callAs(persona, queries.getProjectCustomFieldTable, { projectId });

beforeAll(async () => {
  await setupHarness();
  await defineField("Budget", "number");
  await defineField("Size", "select", ["Small", "Large"]);
  await defineField("Retired", "text");
  await setValue("Budget", 12.5);
  await setValue("Size", "Large");
  await setValue("Retired", "old");
  const archived = await callAs("admin", actions.archiveCustomFieldAction, {
    fieldId: fieldIds["Retired"],
    idempotencyKey: nextKey(),
  });
  if (!archived.ok) {
    throw new Error(archived.error.message);
  }
});
afterAll(teardownHarness);

it("reads the active fields and each task's values for a project's table", async () => {
  const result = await readTable("owner");
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  expect(result.data.fields.map(({ name }) => name)).toEqual([
    "Budget",
    "Size",
  ]);
  expect(result.data.values).toEqual({
    [ids.taskId]: {
      [fieldIds["Budget"] ?? ""]: 12.5,
      [fieldIds["Size"] ?? ""]: "Large",
    },
  });
});

it("keeps archived fields and their stored values out of the read", async () => {
  const result = await readTable("admin");
  expect(JSON.stringify(result)).not.toContain("Retired");
  expect(JSON.stringify(result)).not.toContain("old");
});

it("refuses a client and an unknown project", async () => {
  expect(await readTable("client")).toMatchObject({ ok: false });
  expect(JSON.stringify(await readTable("client"))).not.toContain("Budget");
  expect(await readTable("owner", randomUUID())).toMatchObject({
    data: { fields: [], values: {} },
    ok: true,
  });
});

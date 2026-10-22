import { afterAll, beforeAll, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import {
  authPool,
  callAs,
  ids,
  nextKey,
  personaId,
  setupHarness,
  teardownHarness,
} from "./support/action-harness";

const actions =
  await import("../../features/custom-fields/custom-field-actions");
const queries =
  await import("../../features/custom-fields/custom-field-queries");

const projectId = randomUUID();
const suffix = projectId.replaceAll("-", "").slice(0, 5).toUpperCase();

const createField = (input: Record<string, unknown>, persona = "admin") =>
  callAs(persona as "admin", actions.createCustomFieldAction, {
    idempotencyKey: nextKey(),
    options: [],
    projectId,
    required: false,
    ...input,
  });

const listFields = async () => {
  const result = await callAs("owner", queries.listProjectCustomFields, {
    projectId,
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
};

beforeAll(async () => {
  await setupHarness();
  await authPool.query(
    "INSERT INTO project (id, key, name) VALUES ($1, $2, $3)",
    [projectId, `CF${suffix}`, "Harness custom fields"]
  );
});
afterAll(teardownHarness);

it("lets an administrator define a field that staff then see in order", async () => {
  const created = await createField({ name: "  Budget  ", type: "number" });
  expect(created).toMatchObject({ ok: true });
  const second = await createField({
    name: "Size",
    options: ["Small", "Large"],
    required: true,
    type: "select",
  });
  expect(second).toMatchObject({ ok: true });
  const fields = await listFields();
  expect(fields.map(({ name }) => name)).toEqual(["Budget", "Size"]);
  expect(fields[1]).toMatchObject({
    options: ["Small", "Large"],
    position: 1,
    required: true,
    type: "select",
  });
});

it("refuses to define a field for an employee who is not an administrator", async () => {
  const refused = await createField({ name: "Sneaky", type: "text" }, "owner");
  expect(refused).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
  expect(personaId("owner")).not.toBe("");
  expect(ids.projectId).not.toBe(projectId);
});

it("refuses a duplicate name and a select without options", async () => {
  const duplicate = await createField({ name: "budget", type: "text" });
  expect(duplicate).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const noOptions = await createField({ name: "Empty select", type: "select" });
  expect(noOptions).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
});

it("reorders the active fields and refuses a list that leaves one out", async () => {
  const [first, second] = await listFields();
  const reversed = await callAs("admin", actions.reorderCustomFieldsAction, {
    fieldIds: [second?.id, first?.id],
    idempotencyKey: nextKey(),
    projectId,
  });
  expect(reversed).toMatchObject({ ok: true });
  const reordered = await listFields();
  expect(reordered.map(({ id }) => id)).toEqual(
    [second, first].map((field) => field?.id ?? "")
  );
  const partial = await callAs("admin", actions.reorderCustomFieldsAction, {
    fieldIds: [first?.id],
    idempotencyKey: nextKey(),
    projectId,
  });
  expect(partial).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
});

it("archives a field instead of deleting it, and tolerates a repeat", async () => {
  const [archivedTarget] = await listFields();
  const archive = () =>
    callAs("admin", actions.archiveCustomFieldAction, {
      fieldId: archivedTarget?.id,
      idempotencyKey: nextKey(),
    });
  expect(await archive()).toMatchObject({ ok: true });
  expect(await archive()).toMatchObject({ ok: true });
  const remaining = await listFields();
  expect(remaining.some(({ id }) => id === archivedTarget?.id)).toBe(false);
  const stored = await authPool.query(
    'SELECT "archivedAt" FROM custom_field WHERE id = $1',
    [archivedTarget?.id]
  );
  expect(stored.rows[0]?.archivedAt).not.toBeNull();
  const reused = await createField({
    name: archivedTarget?.name,
    options: archivedTarget?.options,
    type: archivedTarget?.type,
  });
  expect(reused).toMatchObject({ ok: true });
});

it("renames and re-tunes a field, keeping its type, and replays a repeat", async () => {
  const [budget] = await listFields();
  const input = {
    fieldId: budget?.id,
    name: "Budget (USD)",
    options: [],
    required: true,
  };
  const key = nextKey();
  const first = await callAs("admin", actions.updateCustomFieldAction, {
    ...input,
    idempotencyKey: key,
  });
  const second = await callAs("admin", actions.updateCustomFieldAction, {
    ...input,
    idempotencyKey: key,
  });
  expect(first).toMatchObject({ ok: true });
  expect(second).toMatchObject({ data: { done: true }, ok: true });
  expect(await listFields()).toContainEqual(
    expect.objectContaining({
      id: budget?.id,
      name: "Budget (USD)",
      required: true,
      type: "number",
    })
  );
  const clash = await callAs("admin", actions.updateCustomFieldAction, {
    fieldId: budget?.id,
    idempotencyKey: nextKey(),
    name: "size",
    options: [],
    required: false,
  });
  expect(clash).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const rejected = await callAs("owner", actions.updateCustomFieldAction, {
    ...input,
    idempotencyKey: nextKey(),
  });
  expect(rejected).toMatchObject({ error: { code: "FORBIDDEN" }, ok: false });
});

it("stops at twenty active fields and frees a slot when one is archived", async () => {
  const existing = await listFields();
  const room = 20 - existing.length;
  for (let index = 0; index < room; index += 1) {
    // Sequential: each field takes the next position.
    // eslint-disable-next-line no-await-in-loop
    const filler = await createField({ name: `Filler ${index}`, type: "text" });
    expect(filler).toMatchObject({ ok: true });
  }
  const overLimit = await createField({ name: "One too many", type: "text" });
  expect(overLimit).toMatchObject({
    error: { code: "VALIDATION_FAILED" },
    ok: false,
  });
  const [oldest] = await listFields();
  await callAs("admin", actions.archiveCustomFieldAction, {
    fieldId: oldest?.id,
    idempotencyKey: nextKey(),
  });
  expect(await createField({ name: "Fits now", type: "text" })).toMatchObject({
    ok: true,
  });
  const logged = await authPool.query(
    "SELECT action FROM activity WHERE \"projectId\" = $1 AND action LIKE 'project.custom_field_%'",
    [projectId]
  );
  expect(logged.rows.map(({ action }) => action)).toContain(
    "project.custom_field_archived"
  );
});

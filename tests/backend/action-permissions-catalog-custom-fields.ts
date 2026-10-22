import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const fieldActions =
  await import("../../features/custom-fields/custom-field-actions");
const fieldQueries =
  await import("../../features/custom-fields/custom-field-queries");
const valueActions =
  await import("../../features/custom-fields/custom-field-value-actions");

// Defining fields is administrator-only. Reading them is open to staff, and
// setting a value needs the right to edit the task. Clients reach none of it;
// the permission suite checks that for every entry.
export const customFieldActionCatalog: readonly ActionEntry[] = [
  entry(
    "listProjectCustomFields",
    fieldQueries.listProjectCustomFields,
    () => ({
      projectId: ids.projectId,
    })
  ),
  entry("getTaskCustomFields", fieldQueries.getTaskCustomFields, () => ({
    taskId: ids.taskId,
  })),
  entry(
    "createCustomFieldAction",
    fieldActions.createCustomFieldAction,
    () => ({
      idempotencyKey: nextKey(),
      name: "Permission probe",
      options: [],
      projectId: ids.projectId,
      required: false,
      type: "text",
    })
  ),
  entry(
    "updateCustomFieldAction",
    fieldActions.updateCustomFieldAction,
    () => ({
      fieldId: ids.random,
      idempotencyKey: nextKey(),
      name: "Permission probe",
      options: [],
      required: false,
    })
  ),
  entry(
    "archiveCustomFieldAction",
    fieldActions.archiveCustomFieldAction,
    () => ({ fieldId: ids.random, idempotencyKey: nextKey() })
  ),
  entry(
    "reorderCustomFieldsAction",
    fieldActions.reorderCustomFieldsAction,
    () => ({
      fieldIds: [],
      idempotencyKey: nextKey(),
      projectId: ids.projectId,
    })
  ),
  entry(
    "setCustomFieldValueAction",
    valueActions.setCustomFieldValueAction,
    () => ({
      fieldId: ids.random,
      idempotencyKey: nextKey(),
      taskId: ids.taskId,
      value: "Permission probe",
    })
  ),
  entry(
    "clearCustomFieldValueAction",
    valueActions.clearCustomFieldValueAction,
    () => ({
      fieldId: ids.random,
      idempotencyKey: nextKey(),
      taskId: ids.taskId,
    })
  ),
];

const readOnlyOrTaskScoped = new Set([
  "listProjectCustomFields",
  "getTaskCustomFields",
  "setCustomFieldValueAction",
  "clearCustomFieldValueAction",
]);

export const customFieldAdminOnlyNames: readonly string[] =
  customFieldActionCatalog
    .map(({ name }) => name)
    .filter((name) => !readOnlyOrTaskScoped.has(name));

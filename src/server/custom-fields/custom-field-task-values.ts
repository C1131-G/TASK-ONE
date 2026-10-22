import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import type { Transaction } from "../work/work-internal";
import { assertOrdinaryTask } from "../work/work-internal";
import { assertTaskEditPermission } from "../work/work-task-state";
import type { ValueColumns } from "./custom-field-columns";
import { columnsFor, valueFromColumns } from "./custom-field-columns";
import type { TaskCustomFields, ValueChange } from "./custom-field-contracts";
import {
  fieldTypeOf,
  forbidden,
  invalid,
  isUuid,
  loadStaffActor,
  notFound,
  optionsOf,
  recordActivity,
  toActionError,
  toView,
} from "./custom-field-internal";
import { parseFieldValue } from "./custom-field-values";

interface EditTarget {
  readonly field: ResultType<typeof db.orm.public.CustomField>;
  readonly projectId: string;
}

// Everything a write needs to check: the actor may edit this task, the task
// is live, and the field is an active field of the task's own project.
const loadEditTarget = async (
  transaction: Transaction,
  actorId: string,
  taskId: string,
  fieldId: string
): Promise<EditTarget> => {
  const actor = await loadStaffActor(transaction, actorId);
  const task = isUuid(taskId)
    ? await transaction.orm.public.Task.include("project")
        .where({ id: taskId })
        .first()
    : null;
  if (!task) {
    throw notFound("task");
  }
  assertOrdinaryTask(task);
  if (task.archivedAt || task.project.archivedAt) {
    throw forbidden("Archived tasks are read only.");
  }
  const assignments = await transaction.orm.public.TaskAssignee.where({
    taskId,
  })
    .select("userId")
    .all();
  assertTaskEditPermission(
    { deactivatedAt: null, mustChangePassword: false, role: actor.role },
    actorId,
    task.createdById,
    assignments
  );
  const field = isUuid(fieldId)
    ? await transaction.orm.public.CustomField.where({ id: fieldId }).first()
    : null;
  if (!field || field.archivedAt || field.projectId !== task.projectId) {
    throw notFound("field");
  }
  return { field, projectId: task.projectId };
};

const toValueError = (error: unknown): AppError =>
  isUniqueConstraintViolation(error)
    ? new AppError({
        code: "CONFLICT",
        message: "The field changed at the same time. Refresh and try again.",
      })
    : toActionError(error);

// Replaces the stored value, or inserts the first one.
const writeValue = async (
  transaction: Transaction,
  existingId: string | undefined,
  key: { readonly fieldId: string; readonly taskId: string },
  columns: ValueColumns
): Promise<void> => {
  if (existingId === undefined) {
    await transaction.orm.public.CustomFieldValue.create({
      ...columns,
      ...key,
      id: randomUUID(),
    });
    return;
  }
  await transaction.orm.public.CustomFieldValue.where({
    id: existingId,
  }).updateAndCount({ ...columns, updatedAt: new Date() });
};

const setInTransaction = async (
  transaction: Transaction,
  actorId: string,
  taskId: string,
  fieldId: string,
  raw: unknown
): Promise<ValueChange> => {
  const { field, projectId } = await loadEditTarget(
    transaction,
    actorId,
    taskId,
    fieldId
  );
  const type = fieldTypeOf(field);
  const parsed = parseFieldValue({ options: optionsOf(field), type }, raw);
  if (!parsed.ok) {
    throw invalid(parsed.message, "value");
  }
  const existing = await transaction.orm.public.CustomFieldValue.where({
    fieldId,
    taskId,
  }).first();
  if (existing && valueFromColumns(type, existing) === parsed.value) {
    return { changed: false };
  }
  await writeValue(
    transaction,
    existing?.id,
    { fieldId, taskId },
    columnsFor(type, parsed.value)
  );
  await recordActivity(transaction, {
    action: "task.custom_field_set",
    actorId,
    details: { fieldId, name: field.name, value: parsed.value },
    projectId,
    taskId,
  });
  return { changed: true };
};

const clearInTransaction = async (
  transaction: Transaction,
  actorId: string,
  taskId: string,
  fieldId: string
): Promise<ValueChange> => {
  const [{ field, projectId }, existing] = await Promise.all([
    loadEditTarget(transaction, actorId, taskId, fieldId),
    transaction.orm.public.CustomFieldValue.where({ fieldId, taskId }).first(),
  ]);
  if (!existing) {
    return { changed: false };
  }
  if (field.required) {
    throw invalid("This field is required, so its value can only be changed.");
  }
  await transaction.orm.public.CustomFieldValue.where({
    id: existing.id,
  }).deleteAll();
  await recordActivity(transaction, {
    action: "task.custom_field_cleared",
    actorId,
    details: { fieldId, name: field.name },
    projectId,
    taskId,
  });
  return { changed: true };
};

export const setFieldValue = (
  actorId: string,
  taskId: string,
  fieldId: string,
  raw: unknown
) =>
  Effect.tryPromise({
    catch: toValueError,
    try: () =>
      db.transaction((transaction) =>
        setInTransaction(transaction, actorId, taskId, fieldId, raw)
      ),
  });

export const clearFieldValue = (
  actorId: string,
  taskId: string,
  fieldId: string
) =>
  Effect.tryPromise({
    catch: toValueError,
    try: () =>
      db.transaction((transaction) =>
        clearInTransaction(transaction, actorId, taskId, fieldId)
      ),
  });

// The task drawer's read: the project's active fields with this task's value
// for each, and whether the reader may change them.
export const fieldsForTask = (actorId: string, taskId: string) =>
  Effect.tryPromise({
    catch: toActionError,
    try: async (): Promise<TaskCustomFields> => {
      await loadStaffActor(db, actorId);
      const task = isUuid(taskId)
        ? await db.orm.public.Task.include("project")
            .where({ id: taskId })
            .first()
        : null;
      if (!task || task.type === "bug") {
        throw notFound("task");
      }
      const [fields, values, assignments, actor] = await Promise.all([
        db.orm.public.CustomField.where({
          archivedAt: null,
          projectId: task.projectId,
        })
          .orderBy((field) => field.position.asc())
          .all(),
        db.orm.public.CustomFieldValue.where({ taskId }).all(),
        db.orm.public.TaskAssignee.where({ taskId }).select("userId").all(),
        db.orm.public.User.where({ id: actorId }).select("role").first(),
      ]);
      const byField = new Map(values.map((row) => [row.fieldId, row]));
      const isLive = !task.archivedAt && !task.project.archivedAt;
      const mayEdit =
        actor?.role === "admin" ||
        task.createdById === actorId ||
        assignments.some(({ userId }) => userId === actorId);
      return {
        canEdit: isLive && mayEdit,
        fields: fields.map((field) => {
          const row = byField.get(field.id);
          return {
            ...toView(field),
            value: row ? valueFromColumns(fieldTypeOf(field), row) : null,
          };
        }),
      };
    },
  });

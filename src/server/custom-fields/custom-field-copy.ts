import { randomUUID } from "node:crypto";

import type { Transaction } from "../work/work-internal";
import { valueFromColumns } from "./custom-field-columns";
import { MAX_FIELDS_PER_PROJECT } from "./custom-field-definition";
import { fieldTypeOf, recordActivity } from "./custom-field-internal";

// Archived fields are history, not part of the project's shape, so a copy
// never carries them or what was stored under them.
const activeFields = (transaction: Transaction, projectId: string) =>
  transaction.orm.public.CustomField.where({ archivedAt: null, projectId })
    .orderBy((field) => field.position.asc())
    .all();

const valuesOf = (
  transaction: Transaction,
  fieldIds: readonly string[],
  taskIds: readonly string[]
) =>
  fieldIds.length === 0 || taskIds.length === 0
    ? Promise.resolve([])
    : transaction.orm.public.CustomFieldValue.where((value) =>
        value.fieldId.in(fieldIds)
      )
        .where((value) => value.taskId.in(taskIds))
        .all();

// A duplicated task keeps its project, so it keeps the same fields: each
// active field's value is copied onto it, and each one is logged on the copy
// the way setting it by hand would be.
export const copyTaskFieldValues = async (
  transaction: Transaction,
  entry: {
    readonly actorId: string;
    readonly copyTaskId: string;
    readonly projectId: string;
    readonly sourceTaskId: string;
  }
): Promise<number> => {
  const fields = await activeFields(transaction, entry.projectId);
  const rows = await valuesOf(
    transaction,
    fields.map(({ id }) => id),
    [entry.sourceTaskId]
  );
  const fieldById = new Map(fields.map((field) => [field.id, field]));
  const copied = rows.flatMap((row) => {
    const field = fieldById.get(row.fieldId);
    return field ? [{ field, row }] : [];
  });
  await Promise.all(
    copied.map(({ row }) =>
      transaction.orm.public.CustomFieldValue.create({
        boolValue: row.boolValue,
        dateValue: row.dateValue,
        fieldId: row.fieldId,
        id: randomUUID(),
        numberValue: row.numberValue,
        taskId: entry.copyTaskId,
        textValue: row.textValue,
      })
    )
  );
  await Promise.all(
    copied.map(({ field, row }) =>
      recordActivity(transaction, {
        action: "task.custom_field_set",
        actorId: entry.actorId,
        details: {
          fieldId: field.id,
          name: field.name,
          value: valueFromColumns(fieldTypeOf(field), row),
        },
        projectId: entry.projectId,
        taskId: entry.copyTaskId,
      })
    )
  );
  return copied.length;
};

export interface CopiedFields {
  readonly fieldCount: number;
  readonly valueCount: number;
}

// A duplicated project gets its own copy of the source's active field
// definitions, in the same order, and each copied task gets the values its
// source task had. taskIdMap maps source task ids to their copies.
export const copyProjectFields = async (
  transaction: Transaction,
  entry: {
    readonly projectId: string;
    readonly sourceProjectId: string;
    readonly taskIdMap: ReadonlyMap<string, string>;
  }
): Promise<CopiedFields> => {
  const source = await activeFields(transaction, entry.sourceProjectId);
  // The source is already within the limit; this only keeps a copy there.
  const fields = source.slice(0, MAX_FIELDS_PER_PROJECT);
  const fieldIdMap = new Map(fields.map(({ id }) => [id, randomUUID()]));
  await Promise.all(
    fields.map((field, position) =>
      transaction.orm.public.CustomField.create({
        id: fieldIdMap.get(field.id) ?? randomUUID(),
        name: field.name,
        options: field.options,
        position,
        projectId: entry.projectId,
        required: field.required,
        type: field.type,
      })
    )
  );
  const rows = await valuesOf(
    transaction,
    [...fieldIdMap.keys()],
    [...entry.taskIdMap.keys()]
  );
  const copies = rows.flatMap((row) => {
    const fieldId = fieldIdMap.get(row.fieldId);
    const taskId = entry.taskIdMap.get(row.taskId);
    return fieldId && taskId ? [{ fieldId, row, taskId }] : [];
  });
  await Promise.all(
    copies.map(({ fieldId, row, taskId }) =>
      transaction.orm.public.CustomFieldValue.create({
        boolValue: row.boolValue,
        dateValue: row.dateValue,
        fieldId,
        id: randomUUID(),
        numberValue: row.numberValue,
        taskId,
        textValue: row.textValue,
      })
    )
  );
  return { fieldCount: fields.length, valueCount: copies.length };
};

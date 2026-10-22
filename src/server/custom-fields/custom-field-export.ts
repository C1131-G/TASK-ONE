import { db } from "@/src/prisma/db";

import type { CsvCell } from "../tasks/csv";
import { valueFromColumns } from "./custom-field-columns";
import { fieldTypeOf } from "./custom-field-internal";

interface ExportTask {
  readonly id: string;
  readonly projectId: string;
}

export interface CustomFieldColumns {
  readonly cells: (task: ExportTask) => readonly CsvCell[];
  readonly header: readonly string[];
}

// Checkboxes read as true or false; a task with no value leaves its cell empty.
const cellOf = (value: string | number | boolean | null): CsvCell =>
  typeof value === "boolean" ? String(value) : value;

// One extra column per active field of the exported tasks' projects, headed
// custom:<project key>:<field name>. Text goes through the shared CSV escaper
// with everything else, so a value that looks like a formula is neutralised.
export const loadCustomFieldColumns = async (
  projectKeys: ReadonlyMap<string, string>,
  tasks: readonly ExportTask[]
): Promise<CustomFieldColumns> => {
  const projectIds = [...new Set(tasks.map(({ projectId }) => projectId))];
  if (projectIds.length === 0) {
    return { cells: () => [], header: [] };
  }
  const rows = await db.orm.public.CustomField.where((field) =>
    field.projectId.in(projectIds)
  )
    .where({ archivedAt: null })
    .all();
  const fields = rows.toSorted(
    (left, right) =>
      (projectKeys.get(left.projectId) ?? "").localeCompare(
        projectKeys.get(right.projectId) ?? ""
      ) || left.position - right.position
  );
  if (fields.length === 0) {
    return { cells: () => [], header: [] };
  }
  const values = await db.orm.public.CustomFieldValue.where((value) =>
    value.fieldId.in(fields.map(({ id }) => id))
  )
    .where((value) => value.taskId.in(tasks.map(({ id }) => id)))
    .all();
  const valueByCell = new Map(
    values.map((row) => [`${row.taskId}:${row.fieldId}`, row])
  );
  return {
    cells: (task) =>
      fields.map((field) => {
        const row = valueByCell.get(`${task.id}:${field.id}`);
        return row && field.projectId === task.projectId
          ? cellOf(valueFromColumns(fieldTypeOf(field), row))
          : "";
      }),
    header: fields.map(
      (field) =>
        `custom:${projectKeys.get(field.projectId) ?? ""}:${field.name}`
    ),
  };
};

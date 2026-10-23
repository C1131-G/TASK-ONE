import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { valueFromColumns } from "./custom-field-columns";
import type { ProjectCustomFieldTable } from "./custom-field-contracts";
import {
  fieldTypeOf,
  isUuid,
  loadStaffActor,
  notFound,
  toActionError,
  toView,
} from "./custom-field-internal";

// What the project table shows beside the built-in columns: the project's
// active fields, and each task's stored value per field. Archived fields and
// their values stay out. Staff only, like every other custom field read.
export const tableForProject = (actorId: string, projectId: string) =>
  Effect.tryPromise({
    catch: toActionError,
    try: async (): Promise<ProjectCustomFieldTable> => {
      await loadStaffActor(db, actorId);
      if (!isUuid(projectId)) {
        throw notFound("project");
      }
      const rows = await db.orm.public.CustomField.where({
        archivedAt: null,
        projectId,
      })
        .orderBy((field) => field.position.asc())
        .all();
      if (rows.length === 0) {
        return { fields: [], values: {} };
      }
      const typeById = new Map(rows.map((row) => [row.id, fieldTypeOf(row)]));
      const stored = await db.orm.public.CustomFieldValue.where((value) =>
        value.fieldId.in(rows.map(({ id }) => id))
      ).all();
      const values: Record<
        string,
        Record<string, string | number | boolean>
      > = {};
      for (const row of stored) {
        const type = typeById.get(row.fieldId);
        const value = type ? valueFromColumns(type, row) : null;
        if (value !== null) {
          values[row.taskId] = { ...values[row.taskId], [row.fieldId]: value };
        }
      }
      return { fields: rows.map(toView), values };
    },
  });

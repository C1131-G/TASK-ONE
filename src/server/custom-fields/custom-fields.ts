import { Layer } from "effect";

import { CustomFields } from "./custom-field-contracts";
import {
  archiveField,
  createField,
  listProjectFields,
  reorderFields,
  updateField,
} from "./custom-field-definitions";
import { tableForProject } from "./custom-field-table";
import {
  clearFieldValue,
  fieldsForTask,
  setFieldValue,
} from "./custom-field-task-values";

export const CustomFieldsLive = Layer.succeed(
  CustomFields,
  CustomFields.of({
    archive: archiveField,
    clearValue: clearFieldValue,
    create: createField,
    forTask: fieldsForTask,
    listForProject: listProjectFields,
    reorder: reorderFields,
    setValue: setFieldValue,
    tableForProject,
    update: updateField,
  })
);

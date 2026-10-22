/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { CustomFieldEditor } from "@/features/custom-fields/components/custom-field-editor";
import type { TaskCustomFields as TaskCustomFieldsView } from "@/src/server/custom-fields/custom-field-contracts";

// The drawer's "Fields" section: the project's custom fields with this task's
// values. A failed read or a project without fields shows nothing.
export const TaskCustomFields = ({
  customFields,
  onChanged,
  taskId,
}: {
  readonly customFields: TaskCustomFieldsView | null;
  readonly onChanged: () => Promise<void>;
  readonly taskId: string;
}) => {
  if (!customFields || customFields.fields.length === 0) {
    return null;
  }
  return (
    <section aria-label="Fields" className="stack">
      <h3>Fields</h3>
      {customFields.fields.map((field) => (
        <CustomFieldEditor
          canEdit={customFields.canEdit}
          field={field}
          key={field.id}
          onChanged={onChanged}
          taskId={taskId}
        />
      ))}
    </section>
  );
};

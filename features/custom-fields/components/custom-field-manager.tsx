/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { CustomFieldForm } from "@/features/custom-fields/components/custom-field-form";
import {
  archiveCustomFieldAction,
  reorderCustomFieldsAction,
} from "@/features/custom-fields/custom-field-actions";
import { fieldTypeLabel } from "@/features/custom-fields/custom-field-labels";
import type { CustomFieldView } from "@/src/server/custom-fields/custom-field-contracts";
import { MAX_FIELDS_PER_PROJECT } from "@/src/server/custom-fields/custom-field-definition";

const moved = (
  fields: readonly CustomFieldView[],
  index: number,
  offset: number
): string[] => {
  const ids = fields.map(({ id }) => id);
  const target = index + offset;
  const [id] = ids.splice(index, 1);
  if (id !== undefined) {
    ids.splice(target, 0, id);
  }
  return ids;
};

// The administrator's list of a project's fields: add, edit, reorder and
// archive. Archiving hides a field; the values already entered are kept.
export const CustomFieldManager = ({
  fields,
  projectId,
}: {
  readonly fields: readonly CustomFieldView[];
  readonly projectId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = (
    request: () => Promise<{
      readonly ok: boolean;
      readonly error?: { readonly message: string };
    }>
  ) =>
    startTransition(async () => {
      const result = await request();
      setError(result.ok ? null : (result.error?.message ?? null));
    });

  const reorder = (index: number, offset: number) =>
    run(() =>
      reorderCustomFieldsAction({
        fieldIds: moved(fields, index, offset),
        idempotencyKey: crypto.randomUUID(),
        projectId,
      })
    );

  const archive = (fieldId: string) =>
    run(() =>
      archiveCustomFieldAction({
        fieldId,
        idempotencyKey: crypto.randomUUID(),
      })
    );

  return (
    <div aria-busy={pending || undefined} className="stack">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {fields.length === 0 ? (
        <p className="muted">No custom fields yet.</p>
      ) : (
        <ul className="stack">
          {fields.map((field, index) => (
            <li className="panel panel-b stack" key={field.id}>
              <div className="row">
                <div className="grow">
                  <strong>{field.name}</strong>{" "}
                  <span className="muted">
                    {fieldTypeLabel(field.type)}
                    {field.required ? ", required" : ""}
                  </span>
                  {field.options.length > 0 ? (
                    <p className="muted">{field.options.join(", ")}</p>
                  ) : null}
                </div>
                <WorkspaceButton
                  aria-label={`Move ${field.name} up`}
                  className="btn"
                  disabled={pending || index === 0}
                  onClick={() => reorder(index, -1)}
                  type="button"
                >
                  Up
                </WorkspaceButton>
                <WorkspaceButton
                  aria-label={`Move ${field.name} down`}
                  className="btn"
                  disabled={pending || index === fields.length - 1}
                  onClick={() => reorder(index, 1)}
                  type="button"
                >
                  Down
                </WorkspaceButton>
                <WorkspaceButton
                  aria-expanded={editingId === field.id}
                  aria-label={`Edit ${field.name}`}
                  className="btn"
                  onClick={() =>
                    setEditingId(editingId === field.id ? null : field.id)
                  }
                  type="button"
                >
                  Edit
                </WorkspaceButton>
                <WorkspaceConfirmDialog
                  confirmLabel="Archive field"
                  description="The field disappears from tasks and tables. Values already entered are kept."
                  onConfirm={() => archive(field.id)}
                  title={`Archive ${field.name}?`}
                >
                  <WorkspaceButton
                    aria-label={`Archive ${field.name}`}
                    className="btn"
                    disabled={pending}
                    type="button"
                  >
                    Archive
                  </WorkspaceButton>
                </WorkspaceConfirmDialog>
              </div>
              {editingId === field.id ? (
                <CustomFieldForm
                  existing={field}
                  onDone={() => setEditingId(null)}
                  projectId={projectId}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {fields.length < MAX_FIELDS_PER_PROJECT ? (
        <section aria-label="Add a field" className="panel panel-b stack">
          <h2>Add a field</h2>
          <CustomFieldForm
            onDone={() => setError(null)}
            projectId={projectId}
          />
        </section>
      ) : (
        <p className="muted">
          A project can have {MAX_FIELDS_PER_PROJECT} fields. Archive one to add
          another.
        </p>
      )}
    </div>
  );
};

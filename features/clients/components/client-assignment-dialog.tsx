/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import type { VersionSink } from "@/features/clients/components/client-company-forms";

export interface AssignmentOption {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

export type ReceiptResult =
  | { readonly ok: true; readonly data: { readonly version: number } }
  | { readonly ok: false; readonly error: { readonly message: string } };

export const AssignmentDialog = ({
  description,
  emptyMessage,
  idPrefix,
  note,
  onSave,
  onVersion,
  options,
  searchLabel,
  selectedIds,
  title,
}: {
  readonly description: string;
  readonly emptyMessage: string;
  readonly idPrefix: string;
  readonly note: string;
  readonly onSave: (ids: readonly string[]) => Promise<ReceiptResult>;
  readonly onVersion: VersionSink;
  readonly options: readonly AssignmentOption[];
  readonly searchLabel: string;
  readonly selectedIds: readonly string[];
  readonly title: string;
}) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(selectedIds)
  );

  // Each opening starts from the saved selection.
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) {
      setSelected(new Set(selectedIds));
      setQuery("");
      setError(null);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });

  const save = () =>
    startTransition(async () => {
      // Keep only ids still offered, so stale choices are dropped.
      const ids = options.flatMap(({ id }) => (selected.has(id) ? [id] : []));
      const result = await onSave(ids);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      onVersion(result.data.version);
      setOpen(false);
      router.refresh();
    });

  const search = query.trim().toLocaleLowerCase();
  const visible = options.filter(
    (option) =>
      !search ||
      option.label.toLocaleLowerCase().includes(search) ||
      option.detail.toLocaleLowerCase().includes(search)
  );

  return (
    <WorkspaceModal
      description={description}
      onOpenChange={changeOpen}
      open={open}
      title={title}
      trigger={
        <WorkspaceButton className="btn btn-sm btn-secondary" type="button">
          {title}
        </WorkspaceButton>
      }
    >
      <form
        className="panel-b stack clients-dialog-body"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <p className="clients-note">{note}</p>
        <label className="field" htmlFor={`${idPrefix}-search`}>
          <span className="sr-only">{searchLabel}</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            id={`${idPrefix}-search`}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={searchLabel}
            type="search"
            value={query}
          />
        </label>
        <fieldset className="clients-checklist">
          <legend className="sr-only">{title}</legend>
          {visible.length ? (
            visible.map((option) => {
              const inputId = `${idPrefix}-${option.id}`;
              return (
                <label
                  className="clients-check-row"
                  htmlFor={inputId}
                  key={option.id}
                >
                  <Checkbox
                    checked={selected.has(option.id)}
                    id={inputId}
                    onCheckedChange={(checked) =>
                      toggle(option.id, checked === true)
                    }
                  />
                  <span className="clients-check-copy">
                    <strong>{option.label}</strong>
                    <span>{option.detail}</span>
                  </span>
                </label>
              );
            })
          ) : (
            <p className="muted">
              {options.length ? "Nothing matches this search." : emptyMessage}
            </p>
          )}
        </fieldset>
        <p aria-live="polite" className="muted">
          {selected.size} selected
        </p>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="acts">
          <WorkspaceButton
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Saving…" : "Save"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceModal>
  );
};

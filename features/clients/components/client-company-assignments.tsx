/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  setClientCompanyHandlersAction,
  setClientCompanyProjectsAction,
} from "@/features/clients/clients-actions";
import type { VersionSink } from "@/features/clients/components/client-company-forms";
import type { ClientCompanyDetail } from "@/src/server/clients/client-company-contracts";

interface AssignmentOption {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
}

type ReceiptResult =
  | { readonly ok: true; readonly data: { readonly version: number } }
  | { readonly ok: false; readonly error: { readonly message: string } };

const AssignmentDialog = ({
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

const ClientCompanyProjects = ({
  companyId,
  onVersion,
  projectOptions,
  projects,
  version,
}: {
  readonly companyId: string;
  readonly onVersion: VersionSink;
  readonly projectOptions: readonly {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  }[];
  readonly projects: ClientCompanyDetail["projects"];
  readonly version: number;
}) => (
  <section
    aria-labelledby="client-projects-heading"
    className="panel clients-panel"
  >
    <div className="panel-h clients-panel-h">
      <div>
        <h2 id="client-projects-heading">Projects</h2>
        <p className="muted">Client users can report bugs on these projects.</p>
      </div>
      <AssignmentDialog
        description="Choose the active projects this company can report bugs on."
        emptyMessage="There are no active projects."
        idPrefix={`client-${companyId}-project`}
        note="Removing a project only stops new reports. Bugs already reported on it stay visible to the client."
        onSave={(projectIds) =>
          setClientCompanyProjectsAction({
            companyId,
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
            projectIds,
          })
        }
        onVersion={onVersion}
        options={projectOptions.map((project) => ({
          detail: project.key,
          id: project.id,
          label: project.name,
        }))}
        searchLabel="Search projects"
        selectedIds={projects.map(({ id }) => id)}
        title="Manage projects"
      />
    </div>
    {projects.length ? (
      <ul className="clients-list">
        {projects.map((project) => (
          <li className="clients-list-row" key={project.id}>
            <Link
              className="clients-list-link"
              href={`/projects/${project.id}`}
            >
              <span className="mono clients-key">{project.key}</span>
              <strong>{project.name}</strong>
            </Link>
            {project.archived ? (
              <Badge variant="outline">Archived</Badge>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <div className="panel-b muted">
        No projects yet. Client users cannot report bugs until a project is
        linked.
      </div>
    )}
  </section>
);

const ClientCompanyHandlers = ({
  companyId,
  employeeOptions,
  handlers,
  onVersion,
  version,
}: {
  readonly companyId: string;
  readonly employeeOptions: readonly {
    readonly email: string;
    readonly id: string;
    readonly name: string;
  }[];
  readonly handlers: ClientCompanyDetail["handlers"];
  readonly onVersion: VersionSink;
  readonly version: number;
}) => (
  <section
    aria-labelledby="client-handlers-heading"
    className="panel clients-panel"
  >
    <div className="panel-h clients-panel-h">
      <div>
        <h2 id="client-handlers-heading">Handlers</h2>
        <p className="muted">
          Employees who handle this company&apos;s bug reports.
        </p>
      </div>
      <AssignmentDialog
        description="Choose the employees who handle this company's bug reports."
        emptyMessage="There are no active employees."
        idPrefix={`client-${companyId}-handler`}
        note="Removing a handler flags their open bugs from this company for reassignment."
        onSave={(employeeIds) =>
          setClientCompanyHandlersAction({
            companyId,
            employeeIds,
            expectedVersion: version,
            idempotencyKey: crypto.randomUUID(),
          })
        }
        onVersion={onVersion}
        options={employeeOptions.map((employee) => ({
          detail: employee.email,
          id: employee.id,
          label: employee.name,
        }))}
        searchLabel="Search employees"
        selectedIds={handlers.map(({ id }) => id)}
        title="Manage handlers"
      />
    </div>
    {handlers.length ? (
      <ul className="clients-list">
        {handlers.map((handler) => (
          <li className="clients-list-row" key={handler.id}>
            <Link className="clients-list-link" href={`/members/${handler.id}`}>
              <span aria-hidden="true" className="av">
                {handler.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="clients-person">
                <strong>{handler.name}</strong>
                <span>{handler.email}</span>
              </span>
            </Link>
            {handler.active ? null : (
              <Badge variant="outline">Deactivated</Badge>
            )}
          </li>
        ))}
      </ul>
    ) : (
      <div className="panel-b muted">
        No handlers yet. Assign employees to triage this company&apos;s bugs.
      </div>
    )}
  </section>
);

export { ClientCompanyHandlers, ClientCompanyProjects };

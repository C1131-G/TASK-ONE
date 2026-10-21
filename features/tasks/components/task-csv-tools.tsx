/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { useRef, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  csvDownloadName,
  describeImportErrors,
} from "@/features/tasks/task-csv-view";
import {
  getTasksCsvExportAction,
  importTasksCsvAction,
} from "@/features/tasks/tasks-actions";
import { saveCsv } from "@/lib/save-csv";
import type { TaskCsvFilters } from "@/src/server/tasks/task-csv";

interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

const MAX_FILE_BYTES = 1_000_000;

const ExportButton = ({
  filters,
  today,
}: {
  readonly filters: TaskCsvFilters;
  readonly today: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);

  const download = () =>
    startTransition(async () => {
      setFailure(null);
      const result = await getTasksCsvExportAction(filters);
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      saveCsv(result.data, csvDownloadName(today));
    });

  return (
    <>
      <WorkspaceButton
        aria-busy={pending || undefined}
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={download}
        type="button"
      >
        <DownloadSimple aria-hidden="true" size={14} />
        {pending ? "Exporting…" : "Export CSV"}
      </WorkspaceButton>
      {failure ? (
        <p className="muted" role="alert">
          {failure}
        </p>
      ) : null}
    </>
  );
};

const ImportDialog = ({
  projects,
}: {
  readonly projects: readonly ProjectOption[];
}) => {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [problems, setProblems] = useState<readonly string[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // One key per chosen file, so a retried submit cannot import it twice.
  const keyRef = useRef<string | null>(null);

  const reset = () => {
    setProblems([]);
    setSummary(null);
    keyRef.current = null;
  };

  const submit = (formData: FormData) =>
    startTransition(async () => {
      setProblems([]);
      setSummary(null);
      const file = fileRef.current?.files?.[0];
      if (!file) {
        setProblems(["Choose a CSV file to import."]);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setProblems(["The file is too large. Import at most 1 MB at a time."]);
        return;
      }
      const idempotencyKey = keyRef.current ?? crypto.randomUUID();
      keyRef.current = idempotencyKey;
      const result = await importTasksCsvAction({
        idempotencyKey,
        projectId: String(formData.get("projectId") ?? ""),
        text: await file.text(),
      });
      if (!result.ok) {
        setProblems([result.error.message]);
        return;
      }
      if (result.data.errors.length > 0) {
        setProblems(describeImportErrors(result.data.errors));
        return;
      }
      setSummary(
        `Imported ${result.data.created} ${result.data.created === 1 ? "task" : "tasks"}.`
      );
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      keyRef.current = null;
    });

  return (
    <WorkspaceModal
      description="Add tasks to a project from a CSV file. The first row must name the columns, and a title column is required. Nothing is imported unless every row is valid."
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
        }
      }}
      open={open}
      title="Import tasks"
      trigger={
        <WorkspaceButton className="btn btn-secondary btn-sm" type="button">
          <UploadSimple aria-hidden="true" size={14} />
          Import CSV
        </WorkspaceButton>
      }
    >
      <form action={submit} aria-busy={pending || undefined} className="stack">
        <div className="field">
          <label htmlFor="task-import-project">Project</label>
          <WorkspaceCombobox
            ariaLabel="Choose a project"
            className="input"
            defaultValue={projects[0]?.id ?? ""}
            disabled={projects.length === 0}
            emptyMessage="No projects found."
            id="task-import-project"
            name="projectId"
            options={projects.map((project) => ({
              label: project.name,
              value: project.id,
            }))}
            placeholder="Choose project"
            searchPlaceholder="Search projects"
          />
        </div>
        <div className="field">
          <label htmlFor="task-import-file">CSV file</label>
          <input
            accept=".csv,text/csv"
            className="input"
            id="task-import-file"
            onChange={reset}
            ref={fileRef}
            type="file"
          />
          <p className="muted">
            Columns: title, description, status, priority, start_date, due_date
            (YYYY-MM-DD) and assignees (emails separated by semicolons). Up to
            500 tasks.
          </p>
        </div>
        {problems.length > 0 ? (
          <div role="alert">
            <p>
              <strong>
                The file was not imported. Fix these and try again.
              </strong>
            </p>
            <ul>
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {summary ? <output>{summary}</output> : null}
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary"
          disabled={pending || projects.length === 0}
          type="submit"
        >
          {pending ? "Importing…" : "Import tasks"}
        </WorkspaceButton>
      </form>
    </WorkspaceModal>
  );
};

export const TaskCsvTools = ({
  filters,
  projects,
  today,
}: {
  readonly filters: TaskCsvFilters;
  readonly projects: readonly ProjectOption[];
  readonly today: string;
}) => (
  <>
    <ExportButton filters={filters} today={today} />
    <ImportDialog projects={projects} />
  </>
);

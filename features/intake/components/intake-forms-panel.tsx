/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import {
  createIntakeFormAction,
  rotateIntakeFormAction,
  setIntakeFormEnabledAction,
} from "@/features/intake/intake-actions";
import { intakeFormUrl } from "@/features/intake/intake-form-url";
import type { IntakeFormItem } from "@/src/server/intake/intake-form-contracts";

interface Option {
  readonly id: string;
  readonly label: string;
}

const FormRow = ({
  form,
  pending,
  run,
}: {
  readonly form: IntakeFormItem;
  readonly pending: boolean;
  readonly run: (
    task: () => Promise<{
      readonly ok: boolean;
      readonly error?: { readonly message: string };
    }>
  ) => void;
}) => {
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        intakeFormUrl(window.location.origin, form.slug)
      );
      setCopied(true);
    } catch {
      setFailure("Copy failed. Select the link and copy it by hand.");
    }
  };

  return (
    <li className="stack" data-intake-form={form.id}>
      <div className="row">
        <strong>{form.name}</strong>
        <span className="muted">
          {form.companyName} · {form.projectKey} {form.projectName}
        </span>
        <span className="muted">
          {form.enabled ? "Accepting reports" : "Disabled"} ·{" "}
          {form.submissionCount} received
        </span>
      </div>
      <label className="field" htmlFor={`intake-url-${form.id}`}>
        <span>Public link</span>
        <input
          className="input"
          id={`intake-url-${form.id}`}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          value={`/intake/${form.slug}`}
        />
      </label>
      {failure ? <p role="alert">{failure}</p> : null}
      <div className="row">
        <WorkspaceButton
          className="btn btn-secondary btn-sm"
          onClick={copy}
          type="button"
        >
          {copied ? "Copied" : "Copy link"}
        </WorkspaceButton>
        <WorkspaceButton
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={() => {
            setCopied(false);
            run(() =>
              setIntakeFormEnabledAction({
                enabled: !form.enabled,
                expectedVersion: form.version,
                formId: form.id,
                idempotencyKey: crypto.randomUUID(),
              })
            );
          }}
          type="button"
        >
          {form.enabled ? "Disable" : "Enable"}
        </WorkspaceButton>
        <WorkspaceConfirmDialog
          confirmLabel="Rotate link"
          description="The current link stops working right away. Share the new link wherever the old one was used."
          onConfirm={() => {
            setCopied(false);
            run(() =>
              rotateIntakeFormAction({
                expectedVersion: form.version,
                formId: form.id,
                idempotencyKey: crypto.randomUUID(),
              })
            );
          }}
          title="Rotate the public link?"
        >
          <WorkspaceButton
            className="btn btn-danger-ghost btn-sm"
            disabled={pending}
            type="button"
          >
            Rotate link
          </WorkspaceButton>
        </WorkspaceConfirmDialog>
      </div>
    </li>
  );
};

const IntakeFormsPanel = ({
  companies,
  forms,
  projects,
}: {
  readonly companies: readonly Option[];
  readonly forms: readonly IntakeFormItem[];
  readonly projects: readonly Option[];
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");

  const run = (
    task: () => Promise<{
      readonly ok: boolean;
      readonly error?: { readonly message: string };
    }>
  ) =>
    startTransition(async () => {
      const result = await task();
      setError(result.ok ? null : (result.error?.message ?? "Try again."));
    });

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    run(async () => {
      const result = await createIntakeFormAction({
        clientCompanyId: companyId,
        idempotencyKey: crypto.randomUUID(),
        name,
        projectId,
      });
      if (result.ok) {
        setName("");
      }
      return result;
    });
  };

  const canCreate = companies.length > 0 && projects.length > 0;

  return (
    <div className="panel-b stack">
      <p className="muted">
        Each form has its own unguessable link. Anyone with the link can send a
        report, which arrives as a new client bug waiting for triage. Reports
        from email use the same form through the inbound email endpoint.
      </p>
      <form aria-busy={pending} className="stack" noValidate onSubmit={create}>
        <label className="field" htmlFor="intake-name">
          <span>Form name</span>
          <WorkspaceInput
            className="input"
            disabled={pending}
            id="intake-name"
            maxLength={120}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </label>
        <div className="row">
          <label className="field" htmlFor="intake-company">
            <span>Client company</span>
            <WorkspaceSelect
              className="input"
              disabled={pending || !canCreate}
              id="intake-company"
              onValueChange={setCompanyId}
              value={companyId}
            >
              {companies.map((company) => (
                <WorkspaceSelectItem key={company.id} value={company.id}>
                  {company.label}
                </WorkspaceSelectItem>
              ))}
            </WorkspaceSelect>
          </label>
          <label className="field" htmlFor="intake-project">
            <span>Project</span>
            <WorkspaceSelect
              className="input"
              disabled={pending || !canCreate}
              id="intake-project"
              onValueChange={setProjectId}
              value={projectId}
            >
              {projects.map((project) => (
                <WorkspaceSelectItem key={project.id} value={project.id}>
                  {project.label}
                </WorkspaceSelectItem>
              ))}
            </WorkspaceSelect>
          </label>
        </div>
        {error ? <p role="alert">{error}</p> : null}
        <div className="row">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary btn-sm"
            disabled={pending || !canCreate || !name.trim()}
            type="submit"
          >
            {pending ? "Saving…" : "Create form"}
          </WorkspaceButton>
        </div>
      </form>
      {forms.length === 0 ? (
        <p className="muted">No intake forms yet.</p>
      ) : (
        <ul className="stack">
          {forms.map((form) => (
            <FormRow form={form} key={form.id} pending={pending} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
};

export { IntakeFormsPanel };

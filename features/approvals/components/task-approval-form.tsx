/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceTextarea } from "@/components/workspace/workspace-controls";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { requestApprovalAction } from "@/features/approvals/approval-actions";
import type { TaskApprovals } from "@/src/server/approvals/approval-contracts";
import { MAX_APPROVAL_TEXT } from "@/src/server/approvals/approval-contracts";

interface ReadyFile {
  readonly id: string;
  readonly originalName: string;
}

const FIELDS = ["companyId", "fileIds", "message"] as const;

// Sends the task to a client company with the files to review. Only finished
// uploads of this task can be chosen.
export const TaskApprovalForm = ({
  companies,
  files,
  onRequested,
  taskId,
}: {
  readonly companies: TaskApprovals["companies"];
  readonly files: readonly ReadyFile[];
  readonly onRequested: () => Promise<void>;
  readonly taskId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<readonly string[]>([]);
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(FIELDS);

  const chosenIds = new Set(chosen);

  const toggle = (fileId: string, checked: boolean) =>
    setChosen((current) =>
      checked
        ? [...current, fileId]
        : current.filter((value) => value !== fileId)
    );

  const submit = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    startTransition(async () => {
      const result = await requestApprovalAction({
        companyId: String(formData.get("companyId") ?? ""),
        fileIds: chosen,
        idempotencyKey: crypto.randomUUID(),
        message: String(formData.get("message") ?? ""),
        taskId,
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      form.reset();
      setChosen([]);
      await onRequested();
    });
  };

  return (
    <form
      aria-busy={pending || undefined}
      className="stack"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit(event.currentTarget);
      }}
      ref={formRef}
    >
      <div className="field">
        <label htmlFor={`${formId}-companyId`}>Client company</label>
        <select
          className="input"
          id={`${formId}-companyId`}
          name="companyId"
          required
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <WorkspaceFieldError
          errors={errors}
          field="companyId"
          formId={formId}
        />
      </div>
      <fieldset className="field" id={`${formId}-fileIds`}>
        <legend>Files to review</legend>
        {files.length === 0 ? (
          <p className="muted">Attach a file to this task first.</p>
        ) : (
          files.map((file) => (
            <label className="row" key={file.id}>
              <input
                checked={chosenIds.has(file.id)}
                onChange={(event) => toggle(file.id, event.target.checked)}
                type="checkbox"
              />
              <span>{file.originalName}</span>
            </label>
          ))
        )}
        <WorkspaceFieldError errors={errors} field="fileIds" formId={formId} />
      </fieldset>
      <div className="field">
        <label htmlFor={`${formId}-message`}>Message</label>
        <WorkspaceTextarea
          className="input"
          id={`${formId}-message`}
          maxLength={MAX_APPROVAL_TEXT}
          name="message"
          placeholder="What should the client look at?"
          rows={3}
          {...fieldProps("message")}
        />
        <WorkspaceFieldError errors={errors} field="message" formId={formId} />
      </div>
      <WorkspaceFormError errors={errors} />
      <div className="row">
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary"
          disabled={pending || chosen.length === 0}
          type="submit"
        >
          {pending ? "Sending…" : "Request approval"}
        </WorkspaceButton>
      </div>
    </form>
  );
};

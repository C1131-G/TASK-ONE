/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import { createGithubConnectionAction } from "@/features/github/github-actions";
import { WebhookSecretNotice } from "@/features/webhooks/components/webhook-secret-notice";

import { GithubWebhookUrl } from "./github-webhook-url";

const FIELDS = ["repoFullName", "projectId"] as const;

export interface ProjectChoice {
  readonly id: string;
  readonly label: string;
}

interface Revealed {
  readonly name: string;
  readonly secret: string;
}

export const GithubConnectionForm = ({
  projects,
}: {
  readonly projects: readonly ProjectChoice[];
}) => {
  const [pending, startTransition] = useTransition();
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(FIELDS);

  const connect = (form: HTMLFormElement) => {
    const formData = new FormData(form);
    const repoFullName = String(formData.get("repoFullName") ?? "").trim();
    startTransition(async () => {
      const result = await createGithubConnectionAction({
        autoCompleteOnMerge: formData.get("autoCompleteOnMerge") === "on",
        projectId: String(formData.get("projectId") ?? ""),
        repoFullName,
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      clearErrors();
      form.reset();
      setRevealed({
        name: result.data.connection.repoFullName,
        secret: result.data.secret,
      });
    });
  };

  return (
    <section className="panel" data-github-create="true">
      <div className="panel-h">
        <h2>Connect a repository</h2>
        <p>
          Link pull requests to tasks by their key, such as the project key and
          task number in the title or branch name.
        </p>
      </div>
      <form
        aria-busy={pending || undefined}
        className="panel-b stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          connect(event.currentTarget);
        }}
        ref={formRef}
      >
        <div className="field">
          <label htmlFor={`${formId}-repoFullName`}>Repository</label>
          <WorkspaceInput
            className="input"
            id={`${formId}-repoFullName`}
            maxLength={201}
            name="repoFullName"
            placeholder="owner/name"
            {...fieldProps("repoFullName")}
          />
          <WorkspaceFieldError
            errors={errors}
            field="repoFullName"
            formId={formId}
          />
        </div>
        <div className="field">
          <label htmlFor={`${formId}-projectId`}>Project</label>
          <select
            className="input"
            id={`${formId}-projectId`}
            name="projectId"
            required
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.label}
              </option>
            ))}
          </select>
          <WorkspaceFieldError
            errors={errors}
            field="projectId"
            formId={formId}
          />
        </div>
        <label className="row">
          <input name="autoCompleteOnMerge" type="checkbox" />
          <span>Mark a task done when its pull request is merged</span>
        </label>
        <WorkspaceFormError errors={errors} />
        <div className="row">
          <WorkspaceButton
            aria-busy={pending || undefined}
            className="btn btn-primary"
            disabled={pending || projects.length === 0}
            type="submit"
          >
            {pending ? "Connecting…" : "Connect repository"}
          </WorkspaceButton>
        </div>
      </form>
      {revealed ? (
        <div className="panel-b">
          <WebhookSecretNotice
            endpointName={revealed.name}
            onDismiss={() => setRevealed(null)}
            secret={revealed.secret}
          />
        </div>
      ) : null}
      <div className="panel-b">
        <GithubWebhookUrl />
      </div>
    </section>
  );
};

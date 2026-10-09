/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createProjectAction } from "@/app/actions/projects";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";

const templates = [
  ["blank", "Blank project"],
  ["product", "Product launch"],
  ["web", "Website project"],
  ["mkt", "Marketing campaign"],
  ["design", "Design project"],
  ["software", "Software project"],
  ["personal", "Personal project"],
] as const;

const ProjectCreateForm = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const createProject = (formData: FormData) => {
    const name = String(formData.get("name") ?? "").trim();
    const key = String(formData.get("key") ?? "")
      .trim()
      .toUpperCase();
    const description = String(formData.get("description") ?? "").trim();
    const templateId = String(formData.get("templateId") ?? "blank");
    setError(null);
    startTransition(async () => {
      const result = await createProjectAction({
        description: description || null,
        idempotencyKey: crypto.randomUUID(),
        key,
        name,
        status: "planning",
        templateId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/projects/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <details className="panel project-create">
      <summary className="panel-h">
        <span className="btn btn-primary btn-sm">New project</span>
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          createProject(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <label className="field grow">
            <span>Project name</span>
            <WorkspaceInput
              autoComplete="off"
              className="input"
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label className="field">
            <span>Project key</span>
            <WorkspaceInput
              autoComplete="off"
              className="input mono"
              maxLength={12}
              name="key"
              required
            />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={1000}
            name="description"
            rows={2}
          />
        </label>
        <label className="field">
          <span>Template</span>
          <select className="input" defaultValue="blank" name="templateId">
            {templates.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
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
            {pending ? "Creating…" : "Create project"}
          </WorkspaceButton>
        </div>
      </form>
    </details>
  );
};

export { ProjectCreateForm };

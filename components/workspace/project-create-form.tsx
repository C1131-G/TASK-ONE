/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createProjectAction } from "@/app/actions/projects";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";

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
  const [open, setOpen] = useState(false);

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
      setOpen(false);
      router.push(`/projects/${result.data.id}`);
      router.refresh();
    });
  };

  return (
    <WorkspaceModal
      description="Create a project workspace and choose a starter template."
      onOpenChange={setOpen}
      open={open}
      title="New project"
      trigger={
        <WorkspaceButton className="btn btn-primary btn-sm" type="button">
          New project
        </WorkspaceButton>
      }
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          createProject(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <label
            className="field grow"
            htmlFor="metsys-project-create-form-field-84"
          >
            <span>Project name</span>
            <WorkspaceInput
              autoComplete="off"
              className="input"
              maxLength={120}
              name="name"
              required
              id="metsys-project-create-form-field-84"
            />
          </label>
          <label
            className="field"
            htmlFor="metsys-project-create-form-field-94"
          >
            <span>Project key</span>
            <WorkspaceInput
              autoComplete="off"
              className="input mono"
              maxLength={12}
              name="key"
              required
              id="metsys-project-create-form-field-94"
            />
          </label>
        </div>
        <label className="field" htmlFor="metsys-project-create-form-field-113">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={1000}
            name="description"
            rows={2}
            id="metsys-project-create-form-field-113"
          />
        </label>
        <label className="field" htmlFor="metsys-project-create-form-field-114">
          <span>Template</span>
          <WorkspaceSelect
            className="input"
            defaultValue="blank"
            name="templateId"
            id="metsys-project-create-form-field-114"
          >
            {templates.map(([id, label]) => (
              <WorkspaceSelectItem key={id} value={id}>
                {label}
              </WorkspaceSelectItem>
            ))}
          </WorkspaceSelect>
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
    </WorkspaceModal>
  );
};

export { ProjectCreateForm };

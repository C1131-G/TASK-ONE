/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createTaskAction } from "@/app/actions/tasks";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";

interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

export const QuickTaskForm = ({
  projects,
}: {
  readonly projects: readonly ProjectOption[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = (formData: FormData) =>
    startTransition(async () => {
      const result = await createTaskAction({
        assigneeIds: [],
        description: String(formData.get("description") ?? "").trim() || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        idempotencyKey: crypto.randomUUID(),
        priority: String(formData.get("priority") ?? "none"),
        projectId: String(formData.get("projectId") ?? ""),
        title: String(formData.get("title") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.push(`/projects/${result.data.projectId}?view=board`);
      router.refresh();
    });

  return (
    <details className="panel quick-task-form">
      <summary className="panel-h">
        <span className="btn btn-primary btn-sm">＋ New task</span>
      </summary>
      <form action={create} className="panel-b stack">
        <label className="field">
          <span>Task name</span>
          <WorkspaceInput
            autoComplete="off"
            className="input"
            maxLength={200}
            name="title"
            required
          />
        </label>
        <label className="field">
          <span>Project</span>
          <select className="input" name="projectId" required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
            name="description"
            rows={2}
          />
        </label>
        <div className="row">
          <label className="field">
            <span>Priority</span>
            <select className="input" defaultValue="none" name="priority">
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="none">No priority</option>
            </select>
          </label>
          <label className="field">
            <span>Due date</span>
            <WorkspaceInput className="input" name="dueDate" type="date" />
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <WorkspaceButton
          className="btn btn-primary"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creating…" : "Create task"}
        </WorkspaceButton>
      </form>
    </details>
  );
};

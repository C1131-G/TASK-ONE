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

const TaskCreateForm = ({ projectId }: { readonly projectId: string }) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const createTask = (formData: FormData) => {
    const title = String(formData.get("title") ?? "").trim();
    const dueDate = String(formData.get("dueDate") ?? "");
    const description = String(formData.get("description") ?? "").trim();
    const priority = String(formData.get("priority") ?? "none");
    setError(null);
    startTransition(async () => {
      const result = await createTaskAction({
        assigneeIds: [],
        description: description || null,
        dueDate: dueDate || null,
        idempotencyKey: crypto.randomUUID(),
        priority,
        projectId,
        title,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  };

  return (
    <details className="panel task-create">
      <summary className="panel-h">
        <span className="btn btn-primary btn-sm">New task</span>
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          createTask(new FormData(event.currentTarget));
        }}
      >
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
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            maxLength={10_000}
            name="description"
            rows={3}
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
        <div className="acts">
          <WorkspaceButton
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating…" : "Create task"}
          </WorkspaceButton>
        </div>
      </form>
    </details>
  );
};

export { TaskCreateForm };

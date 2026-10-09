/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  archiveProjectAction,
  duplicateProjectAction,
  setProjectPeopleAction,
  updateProjectAction,
} from "@/app/actions/projects";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";

interface ProjectControlsData {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "planning" | "active" | "risk" | "hold" | "complete";
  readonly version: number;
  readonly memberIds: readonly string[];
  readonly leadId: string | null;
  readonly color: string;
  readonly icon: string;
  readonly position: number;
  readonly teamId: string | null;
  readonly startDate: string | null;
  readonly dueDate: string | null;
}

interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

interface TeamOption {
  readonly id: string;
  readonly name: string;
}

const ProjectEditForm = ({
  project,
  teams,
}: {
  readonly project: ProjectControlsData;
  readonly teams: readonly TeamOption[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const update = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateProjectAction({
        color: String(formData.get("color") ?? project.color),
        description: String(formData.get("description") ?? "").trim() || null,
        dueDate: String(formData.get("dueDate") ?? "") || null,
        expectedVersion: project.version,
        icon: String(formData.get("icon") ?? project.icon),
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
        position: Number(formData.get("position") ?? project.position),
        projectId: project.id,
        startDate: String(formData.get("startDate") ?? "") || null,
        status: String(formData.get("status") ?? project.status),
        teamId: String(formData.get("teamId") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  return (
    <details className="panel">
      <summary className="panel-h">
        <strong>Edit project</strong>
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          update(new FormData(event.currentTarget));
        }}
      >
        <label className="field">
          <span>Name</span>
          <WorkspaceInput
            className="input"
            defaultValue={project.name}
            maxLength={120}
            name="name"
            required
          />
        </label>
        <label className="field">
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            defaultValue={project.description ?? ""}
            maxLength={1000}
            name="description"
            rows={2}
          />
        </label>
        <label className="field">
          <span>Status</span>
          <select className="input" defaultValue={project.status} name="status">
            <option value="planning">Planning</option>
            <option value="active">In Progress</option>
            <option value="risk">At Risk</option>
            <option value="hold">On Hold</option>
            <option value="complete">Completed</option>
          </select>
        </label>
        <div className="row">
          <label className="field">
            <span>Start date</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.startDate ?? ""}
              name="startDate"
              type="date"
            />
          </label>
          <label className="field">
            <span>Due date</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.dueDate ?? ""}
              name="dueDate"
              type="date"
            />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Team</span>
            <select
              className="input"
              defaultValue={project.teamId ?? ""}
              name="teamId"
            >
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Position</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.position}
              min={0}
              name="position"
              type="number"
            />
          </label>
        </div>
        <div className="row">
          <label className="field">
            <span>Appearance color</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.color}
              maxLength={40}
              name="color"
            />
          </label>
          <label className="field">
            <span>Icon</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.icon}
              maxLength={40}
              name="icon"
            />
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
          {pending ? "Saving…" : "Save changes"}
        </WorkspaceButton>
      </form>
    </details>
  );
};

const ProjectAdminControls = ({
  project,
  employees,
  teams,
}: {
  readonly project: ProjectControlsData;
  readonly employees: readonly EmployeeOption[];
  readonly teams: readonly TeamOption[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const selectedMemberIds = new Set(project.memberIds);

  const updatePeople = (formData: FormData) =>
    startTransition(async () => {
      const memberIds = formData.getAll("memberIds").map(String);
      const result = await setProjectPeopleAction({
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        leadId: String(formData.get("leadId") ?? "") || null,
        memberIds,
        projectId: project.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const duplicate = (formData: FormData) =>
    startTransition(async () => {
      const result = await duplicateProjectAction({
        idempotencyKey: crypto.randomUUID(),
        key: String(formData.get("key") ?? "")
          .trim()
          .toUpperCase(),
        name: String(formData.get("name") ?? "").trim(),
        sourceProjectId: project.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push(`/projects/${result.data.id}`);
      router.refresh();
    });

  const archive = () =>
    startTransition(async () => {
      const result = await archiveProjectAction({
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        projectId: project.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.push("/archive" as Route);
      router.refresh();
    });

  return (
    <div className="stack project-controls">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <ProjectEditForm project={project} teams={teams} />
      <details className="panel">
        <summary className="panel-h">
          <strong>People</strong>
        </summary>
        <form
          className="panel-b stack"
          onSubmit={(event) => {
            event.preventDefault();
            updatePeople(new FormData(event.currentTarget));
          }}
        >
          <label className="field">
            <span>Project lead</span>
            <select
              className="input"
              defaultValue={project.leadId ?? ""}
              name="leadId"
            >
              <option value="">No lead</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="field">
            <legend>Members</legend>
            {employees.map((employee) => (
              <label className="row" key={employee.id}>
                <input
                  defaultChecked={selectedMemberIds.has(employee.id)}
                  name="memberIds"
                  type="checkbox"
                  value={employee.id}
                />
                <span>{employee.name}</span>
              </label>
            ))}
          </fieldset>
          <WorkspaceButton
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            Save people
          </WorkspaceButton>
        </form>
      </details>
      <details className="panel">
        <summary className="panel-h">
          <strong>Duplicate project</strong>
        </summary>
        <form
          className="panel-b stack"
          onSubmit={(event) => {
            event.preventDefault();
            duplicate(new FormData(event.currentTarget));
          }}
        >
          <label className="field">
            <span>New project name</span>
            <WorkspaceInput
              className="input"
              defaultValue={`${project.name} copy`}
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label className="field">
            <span>Project key</span>
            <WorkspaceInput
              className="input mono"
              defaultValue={`${project.key}-COPY`}
              maxLength={12}
              name="key"
              required
            />
          </label>
          <WorkspaceButton
            className="btn btn-secondary"
            disabled={pending}
            type="submit"
          >
            Duplicate
          </WorkspaceButton>
        </form>
      </details>
      <div className="acts">
        <WorkspaceButton
          className="btn btn-secondary"
          disabled={pending}
          onClick={archive}
          type="button"
        >
          Archive project
        </WorkspaceButton>
      </div>
    </div>
  );
};

export { ProjectAdminControls };

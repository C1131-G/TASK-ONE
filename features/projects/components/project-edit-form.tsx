/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { updateProjectAction } from "@/features/projects/projects-actions";
import type {
  ProjectControlsData,
  TeamOption,
} from "@/features/projects/types/project-admin-contracts";

const ProjectEditForm = ({
  project,
  teams,
}: {
  readonly project: ProjectControlsData;
  readonly teams: readonly TeamOption[];
}) => {
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
    });

  return (
    <WorkspaceDisclosure
      description={`Update settings for ${project.name}.`}
      title="Edit project"
      trigger={
        <WorkspaceButton className="btn btn-sm btn-ghost" type="button">
          Edit project
        </WorkspaceButton>
      }
    >
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          update(new FormData(event.currentTarget));
        }}
      >
        <label className="field" htmlFor={`project-${project.id}-field-107`}>
          <span>Name</span>
          <WorkspaceInput
            className="input"
            defaultValue={project.name}
            maxLength={120}
            name="name"
            required
            id={`project-${project.id}-field-107`}
          />
        </label>
        <label className="field" htmlFor={`project-${project.id}-field-118`}>
          <span>Description</span>
          <WorkspaceTextarea
            className="input"
            defaultValue={project.description ?? ""}
            maxLength={1000}
            name="description"
            rows={2}
            id={`project-${project.id}-field-118`}
          />
        </label>
        <label className="field" htmlFor={`project-${project.id}-field-127`}>
          <span>Status</span>
          <WorkspaceSelect
            className="input"
            defaultValue={project.status}
            name="status"
            id={`project-${project.id}-field-127`}
          >
            <WorkspaceSelectItem value="planning">Planning</WorkspaceSelectItem>
            <WorkspaceSelectItem value="active">
              In Progress
            </WorkspaceSelectItem>
            <WorkspaceSelectItem value="risk">At Risk</WorkspaceSelectItem>
            <WorkspaceSelectItem value="hold">On Hold</WorkspaceSelectItem>
            <WorkspaceSelectItem value="complete">
              Completed
            </WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <div className="row">
          <label className="field" htmlFor={`project-${project.id}-field-146`}>
            <span>Start date</span>
            <WorkspaceDatePicker
              className="input"
              defaultValue={project.startDate}
              name="startDate"
              id={`project-${project.id}-field-146`}
            />
          </label>
          <label className="field" htmlFor={`project-${project.id}-field-154`}>
            <span>Due date</span>
            <WorkspaceDatePicker
              className="input"
              defaultValue={project.dueDate}
              name="dueDate"
              id={`project-${project.id}-field-154`}
            />
          </label>
        </div>
        <div className="row">
          <label className="field" htmlFor={`project-${project.id}-field-164`}>
            <span>Team</span>
            <WorkspaceSelect
              className="input"
              defaultValue={project.teamId ?? ""}
              name="teamId"
              id={`project-${project.id}-field-164`}
            >
              <WorkspaceSelectItem value="">No team</WorkspaceSelectItem>
              {teams.map((team) => (
                <WorkspaceSelectItem key={team.id} value={team.id}>
                  {team.name}
                </WorkspaceSelectItem>
              ))}
            </WorkspaceSelect>
          </label>
          <label className="field" htmlFor={`project-${project.id}-field-179`}>
            <span>Position</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.position}
              min={0}
              name="position"
              type="number"
              id={`project-${project.id}-field-179`}
            />
          </label>
        </div>
        <div className="row">
          <label className="field" htmlFor={`project-${project.id}-field-191`}>
            <span>Appearance color</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.color}
              maxLength={40}
              name="color"
              id={`project-${project.id}-field-191`}
            />
          </label>
          <label className="field" htmlFor={`project-${project.id}-field-200`}>
            <span>Icon</span>
            <WorkspaceInput
              className="input"
              defaultValue={project.icon}
              maxLength={40}
              name="icon"
              id={`project-${project.id}-field-200`}
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
    </WorkspaceDisclosure>
  );
};

export { ProjectEditForm };

/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

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
import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
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
  const [memberQuery, setMemberQuery] = useState("");
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
    <div className="acts project-controls">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <ProjectEditForm project={project} teams={teams} />
      <WorkspaceDisclosure
        description="Choose the project lead and members."
        title="Project people"
        trigger={
          <WorkspaceButton className="btn btn-sm btn-ghost" type="button">
            People
          </WorkspaceButton>
        }
      >
        <form
          className="panel-b stack"
          onSubmit={(event) => {
            event.preventDefault();
            updatePeople(new FormData(event.currentTarget));
          }}
        >
          <label className="field" htmlFor={`project-${project.id}-field-316`}>
            <span>Project lead</span>
            <WorkspaceCombobox
              ariaLabel="Choose project lead"
              className="input"
              defaultValue={project.leadId ?? ""}
              emptyMessage="No employees found."
              id={`project-${project.id}-field-316`}
              key={`${project.id}-lead-${project.leadId ?? "none"}`}
              name="leadId"
              options={[
                { label: "No lead", value: "" },
                ...employees.map((employee) => ({
                  label: employee.name,
                  value: employee.id,
                })),
              ]}
              placeholder="No lead"
              searchPlaceholder="Search employees"
            />
          </label>
          <fieldset className="field">
            <legend>Members</legend>
            <label
              className="field"
              htmlFor={`project-${project.id}-member-search`}
            >
              <span className="sr-only">Search project members</span>
              <WorkspaceInput
                autoComplete="off"
                className="input"
                id={`project-${project.id}-member-search`}
                onChange={(event) => setMemberQuery(event.currentTarget.value)}
                placeholder="Search employees"
                type="search"
                value={memberQuery}
              />
            </label>
            {employees.map((employee) => (
              <label
                className="row"
                hidden={
                  !employee.name
                    .toLocaleLowerCase()
                    .includes(memberQuery.trim().toLocaleLowerCase())
                }
                key={employee.id}
                htmlFor={`employee-${employee.id}-project-member`}
              >
                <Checkbox
                  defaultChecked={selectedMemberIds.has(employee.id)}
                  name="memberIds"
                  value={employee.id}
                  id={`employee-${employee.id}-project-member`}
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
      </WorkspaceDisclosure>
      <WorkspaceDisclosure
        description="Create a copy of this project with a new name and key."
        title="Duplicate project"
        trigger={
          <WorkspaceButton className="btn btn-sm btn-ghost" type="button">
            Duplicate project
          </WorkspaceButton>
        }
      >
        <form
          className="panel-b stack"
          onSubmit={(event) => {
            event.preventDefault();
            duplicate(new FormData(event.currentTarget));
          }}
        >
          <label className="field" htmlFor={`project-${project.id}-field-369`}>
            <span>New project name</span>
            <WorkspaceInput
              className="input"
              defaultValue={`${project.name} copy`}
              maxLength={120}
              name="name"
              required
              id={`project-${project.id}-field-369`}
            />
          </label>
          <label className="field" htmlFor={`project-${project.id}-field-379`}>
            <span>Project key</span>
            <WorkspaceInput
              className="input mono"
              defaultValue={`${project.key}-COPY`}
              maxLength={12}
              name="key"
              required
              id={`project-${project.id}-field-379`}
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
      </WorkspaceDisclosure>
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

/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceCombobox } from "@/components/workspace/workspace-combobox";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import { ProjectEditForm } from "@/features/projects/components/project-edit-form";
import {
  archiveProjectAction,
  duplicateProjectAction,
  setProjectPeopleAction,
} from "@/features/projects/projects-actions";
import type {
  EmployeeOption,
  ProjectControlsData,
  TeamOption,
} from "@/features/projects/types/project-admin-contracts";

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
      router.push("/archive");
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

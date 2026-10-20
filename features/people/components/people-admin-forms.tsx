/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useId, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { TemporaryPasswordReveal } from "@/features/people/components/temporary-password-reveal";
import {
  createEmployeeAction,
  createTeamAction,
} from "@/features/people/people-actions";

interface TeamOption {
  readonly id: string;
  readonly name: string;
}

const EmployeeCreateForm = ({
  defaultTeamId,
  triggerLabel = "Add employee",
  teams,
}: {
  readonly defaultTeamId?: string;
  readonly triggerLabel?: string;
  readonly teams: readonly TeamOption[];
}) => {
  const fieldId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );
  const create = (formData: FormData) => {
    setError(null);
    setTemporaryPassword(null);
    startTransition(async () => {
      const result = await createEmployeeAction({
        email: String(formData.get("email") ?? "").trim(),
        idempotencyKey: crypto.randomUUID(),
        jobTitle: String(formData.get("jobTitle") ?? "").trim() || null,
        name: String(formData.get("name") ?? "").trim(),
        role: String(formData.get("role") ?? "employee"),
        teamId: String(formData.get("teamId") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setTemporaryPassword(result.data.temporaryPassword);
    });
  };
  return (
    <WorkspaceDisclosure
      description="Create an employee account with a temporary password."
      title="Add employee"
      trigger={
        <WorkspaceButton className="btn btn-primary btn-sm" type="button">
          {triggerLabel}
        </WorkspaceButton>
      }
    >
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          create(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <label className="field grow" htmlFor={`${fieldId}-name`}>
            <span>Name</span>
            <WorkspaceInput
              autoComplete="name"
              className="input"
              maxLength={120}
              name="name"
              required
              id={`${fieldId}-name`}
            />
          </label>
          <label className="field grow" htmlFor={`${fieldId}-email`}>
            <span>Work email</span>
            <WorkspaceInput
              autoComplete="email"
              className="input"
              maxLength={254}
              name="email"
              required
              type="email"
              id={`${fieldId}-email`}
            />
          </label>
        </div>
        <div className="row">
          <label className="field grow" htmlFor={`${fieldId}-jobTitle`}>
            <span>Job title</span>
            <WorkspaceInput
              autoComplete="organization-title"
              className="input"
              maxLength={120}
              name="jobTitle"
              id={`${fieldId}-jobTitle`}
            />
          </label>
          <label className="field" htmlFor={`${fieldId}-role`}>
            <span>Role</span>
            <WorkspaceSelect
              className="input"
              defaultValue="employee"
              name="role"
              id={`${fieldId}-role`}
            >
              <WorkspaceSelectItem value="employee">
                Employee
              </WorkspaceSelectItem>
              <WorkspaceSelectItem value="admin">Admin</WorkspaceSelectItem>
            </WorkspaceSelect>
          </label>
          <label className="field" htmlFor={`${fieldId}-teamId`}>
            <span>Team</span>
            <WorkspaceSelect
              className="input"
              defaultValue={defaultTeamId ?? ""}
              name="teamId"
              id={`${fieldId}-teamId`}
            >
              <WorkspaceSelectItem value="">No team</WorkspaceSelectItem>
              {teams.map((team) => (
                <WorkspaceSelectItem key={team.id} value={team.id}>
                  {team.name}
                </WorkspaceSelectItem>
              ))}
            </WorkspaceSelect>
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {temporaryPassword ? (
          <TemporaryPasswordReveal
            note="It is shown once. The employee must change it at sign in."
            password={temporaryPassword}
            title="Temporary password — share it securely now"
          />
        ) : null}
        <div className="acts">
          <WorkspaceButton
            className="btn btn-primary"
            disabled={pending}
            type="submit"
          >
            {pending ? "Creating…" : "Create account"}
          </WorkspaceButton>
        </div>
      </form>
    </WorkspaceDisclosure>
  );
};

const TeamCreateForm = () => {
  const fieldId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = (formData: FormData, close: () => void) =>
    startTransition(async () => {
      const result = await createTeamAction({
        color: String(formData.get("color")),
        description: String(formData.get("description") ?? "").trim() || null,
        idempotencyKey: crypto.randomUUID(),
        name: String(formData.get("name") ?? "").trim(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      close();
    });
  return (
    <WorkspaceDisclosure
      description="Create a team to organize employees."
      title="New team"
      trigger={
        <WorkspaceButton className="btn btn-primary btn-sm" type="button">
          New team
        </WorkspaceButton>
      }
    >
      {(close) => (
        <form
          className="panel-b stack"
          onSubmit={(event) => {
            event.preventDefault();
            create(new FormData(event.currentTarget), close);
          }}
        >
          <div className="row">
            <label className="field grow" htmlFor={`${fieldId}-name`}>
              <span>Team name</span>
              <WorkspaceInput
                className="input"
                maxLength={80}
                name="name"
                required
                id={`${fieldId}-name`}
              />
            </label>
            <label className="field" htmlFor={`${fieldId}-color`}>
              <span>Color</span>
              <WorkspaceInput
                className="input"
                defaultValue="#4b5bd6"
                name="color"
                type="color"
                id={`${fieldId}-color`}
              />
            </label>
          </div>
          <label className="field" htmlFor={`${fieldId}-description`}>
            <span>Description</span>
            <WorkspaceInput
              className="input"
              maxLength={500}
              name="description"
              id={`${fieldId}-description`}
            />
          </label>
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
            {pending ? "Creating…" : "Create team"}
          </WorkspaceButton>
        </form>
      )}
    </WorkspaceDisclosure>
  );
};

export { EmployeeCreateForm, TeamCreateForm };

/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { createEmployeeAction } from "@/app/actions/employees";
import { createTeamAction } from "@/app/actions/teams";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

interface TeamOption {
  readonly id: string;
  readonly name: string;
}

const EmployeeCreateForm = ({
  teams,
}: {
  readonly teams: readonly TeamOption[];
}) => {
  const router = useRouter();
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
      router.refresh();
    });
  };
  return (
    <details className="panel">
      <summary className="panel-h">
        <span className="btn btn-primary btn-sm">Add employee</span>
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          create(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <label className="field grow">
            <span>Name</span>
            <WorkspaceInput
              autoComplete="name"
              className="input"
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label className="field grow">
            <span>Work email</span>
            <WorkspaceInput
              autoComplete="email"
              className="input"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </label>
        </div>
        <div className="row">
          <label className="field grow">
            <span>Job title</span>
            <WorkspaceInput
              autoComplete="organization-title"
              className="input"
              maxLength={120}
              name="jobTitle"
            />
          </label>
          <label className="field">
            <span>Role</span>
            <select className="input" defaultValue="employee" name="role">
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label className="field">
            <span>Team</span>
            <select className="input" defaultValue="" name="teamId">
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {temporaryPassword ? (
          <output className="panel-b">
            <strong>Temporary password — share it securely now</strong>
            <p className="mono">{temporaryPassword}</p>
            <p className="muted">
              It is shown once. The employee must change it at sign in.
            </p>
          </output>
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
    </details>
  );
};

const TeamCreateForm = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const create = (formData: FormData) =>
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
      router.refresh();
    });
  return (
    <details className="panel">
      <summary className="panel-h">
        <span className="btn btn-primary btn-sm">New team</span>
      </summary>
      <form
        className="panel-b stack"
        onSubmit={(event) => {
          event.preventDefault();
          create(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <label className="field grow">
            <span>Team name</span>
            <WorkspaceInput
              className="input"
              maxLength={80}
              name="name"
              required
            />
          </label>
          <label className="field">
            <span>Color</span>
            <WorkspaceInput
              className="input"
              defaultValue="#4b5bd6"
              name="color"
              type="color"
            />
          </label>
        </div>
        <label className="field">
          <span>Description</span>
          <WorkspaceInput
            className="input"
            maxLength={500}
            name="description"
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
    </details>
  );
};

export { EmployeeCreateForm, TeamCreateForm };

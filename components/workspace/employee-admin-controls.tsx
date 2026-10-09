/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  changeEmployeeRoleAction,
  deactivateEmployeeAction,
  resetEmployeePasswordAction,
  updateEmployeeDetailsAction,
} from "@/app/actions/employees";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

interface Employee {
  readonly id: string;
  readonly email: string;
  readonly jobTitle: string | null;
  readonly role: "admin" | "employee";
  readonly teamId: string | null;
}

interface Team {
  readonly id: string;
  readonly name: string;
}

export const EmployeeAdminControls = ({
  employee,
  teams,
}: {
  readonly employee: Employee;
  readonly teams: readonly Team[];
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );

  const saveDetails = (formData: FormData) =>
    startTransition(async () => {
      const result = await updateEmployeeDetailsAction({
        email: String(formData.get("email") ?? "").trim(),
        employeeId: employee.id,
        idempotencyKey: crypto.randomUUID(),
        jobTitle: String(formData.get("jobTitle") ?? "").trim() || null,
        teamId: String(formData.get("teamId") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const changeRole = (role: "admin" | "employee") =>
    startTransition(async () => {
      const result = await changeEmployeeRoleAction({
        employeeId: employee.id,
        idempotencyKey: crypto.randomUUID(),
        role,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const resetPassword = () =>
    startTransition(async () => {
      const result = await resetEmployeePasswordAction({
        employeeId: employee.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setTemporaryPassword(result.data.temporaryPassword);
    });

  const deactivate = () =>
    startTransition(async () => {
      const result = await deactivateEmployeeAction({
        employeeId: employee.id,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  return (
    <details className="employee-admin-controls">
      <summary className="btn btn-sm btn-ghost">Manage</summary>
      <div className="panel-b stack">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <form action={saveDetails} className="stack">
          <label className="field">
            <span>Login email</span>
            <WorkspaceInput
              autoComplete="email"
              className="input"
              defaultValue={employee.email}
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="field">
            <span>Job title</span>
            <WorkspaceInput
              className="input"
              defaultValue={employee.jobTitle ?? ""}
              maxLength={120}
              name="jobTitle"
            />
          </label>
          <label className="field">
            <span>Team</span>
            <select
              className="input"
              defaultValue={employee.teamId ?? ""}
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
          <WorkspaceButton
            className="btn btn-sm btn-secondary"
            disabled={pending}
            type="submit"
          >
            Save details
          </WorkspaceButton>
        </form>
        <label className="field">
          <span>Role</span>
          <select
            className="input"
            disabled={pending}
            onChange={(event) =>
              changeRole(event.currentTarget.value as "admin" | "employee")
            }
            value={employee.role}
          >
            <option value="employee">Employee</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <div className="row">
          <WorkspaceButton
            className="btn btn-sm btn-secondary"
            disabled={pending}
            onClick={resetPassword}
            type="button"
          >
            Reset password
          </WorkspaceButton>
          <WorkspaceButton
            className="btn btn-sm btn-ghost"
            disabled={pending}
            onClick={deactivate}
            type="button"
          >
            Deactivate
          </WorkspaceButton>
        </div>
        {temporaryPassword ? (
          <output className="panel-b">
            <strong>Temporary password — share securely now</strong>
            <p className="mono">{temporaryPassword}</p>
            <p className="muted">
              It is shown once. The employee must change it at the next sign in.
            </p>
          </output>
        ) : null}
      </div>
    </details>
  );
};

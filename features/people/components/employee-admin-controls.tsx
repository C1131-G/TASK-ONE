/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useOptimistic, useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { EmployeeDetailsForm } from "@/features/people/components/employee-details-form";
import { TemporaryPasswordReveal } from "@/features/people/components/temporary-password-reveal";
import {
  changeEmployeeRoleAction,
  deactivateEmployeeAction,
  resetEmployeePasswordAction,
} from "@/features/people/people-actions";

type EmployeeRole = "admin" | "employee";

const isEmployeeRole = (value: string): value is EmployeeRole =>
  value === "admin" || value === "employee";

const roleChangeDescription = (email: string, role: EmployeeRole | null) =>
  role === "admin"
    ? `Make ${email} an admin? Admins can manage every person, project and setting.`
    : `Make ${email} an employee? They lose access to admin tools.`;

interface Employee {
  readonly id: string;
  readonly email: string;
  readonly jobTitle: string | null;
  readonly role: EmployeeRole;
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
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );
  const [optimisticRole, setOptimisticRole] = useOptimistic(employee.role);
  // The role picked in the select, held until the admin confirms or cancels.
  const [requestedRole, setRequestedRole] = useState<EmployeeRole | null>(null);

  const changeRole = (role: EmployeeRole) =>
    startTransition(async () => {
      setOptimisticRole(role);
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
    });

  return (
    <WorkspaceDisclosure
      description={`Manage the account and access for ${employee.email}.`}
      title="Manage employee"
      trigger={
        <WorkspaceButton className="btn btn-sm btn-ghost" type="button">
          Manage
        </WorkspaceButton>
      }
    >
      <div className="panel-b stack">
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <EmployeeDetailsForm employee={employee} teams={teams} />
        <label className="field" htmlFor={`employee-${employee.id}-field-170`}>
          <span>Role</span>
          <WorkspaceSelect
            className="input"
            disabled={pending}
            onValueChange={(role) => {
              if (isEmployeeRole(role) && role !== optimisticRole) {
                setRequestedRole(role);
              }
            }}
            value={requestedRole ?? optimisticRole}
            id={`employee-${employee.id}-field-170`}
          >
            <WorkspaceSelectItem value="employee">Employee</WorkspaceSelectItem>
            <WorkspaceSelectItem value="admin">Admin</WorkspaceSelectItem>
          </WorkspaceSelect>
        </label>
        <WorkspaceConfirmDialog
          confirmLabel="Change role"
          description={roleChangeDescription(employee.email, requestedRole)}
          onConfirm={() => {
            if (requestedRole) {
              changeRole(requestedRole);
            }
          }}
          onOpenChange={(open) => {
            if (!open) {
              setRequestedRole(null);
            }
          }}
          open={requestedRole !== null}
          title="Change role"
        />
        <div className="row">
          <WorkspaceConfirmDialog
            confirmLabel="Reset password"
            description={`Reset the password for ${employee.email}? Their current password stops working and a temporary one is shown once.`}
            onConfirm={resetPassword}
            title="Reset password"
          >
            <WorkspaceButton
              className="btn btn-sm btn-secondary"
              disabled={pending}
              type="button"
            >
              Reset password
            </WorkspaceButton>
          </WorkspaceConfirmDialog>
          <WorkspaceConfirmDialog
            confirmLabel="Deactivate"
            description={`Deactivate ${employee.email}? They are signed out and can no longer sign in.`}
            onConfirm={deactivate}
            title="Deactivate employee"
          >
            <WorkspaceButton
              className="btn btn-sm btn-ghost"
              disabled={pending}
              type="button"
            >
              Deactivate
            </WorkspaceButton>
          </WorkspaceConfirmDialog>
        </div>
        {temporaryPassword ? (
          <TemporaryPasswordReveal
            note="It is shown once. The employee must change it at the next sign in."
            password={temporaryPassword}
            title="Temporary password — share securely now"
          />
        ) : null}
      </div>
    </WorkspaceDisclosure>
  );
};

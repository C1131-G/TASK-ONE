/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { TemporaryPasswordReveal } from "@/features/people/components/temporary-password-reveal";
import { createEmployeeAction } from "@/features/people/people-actions";

interface TeamOption {
  readonly id: string;
  readonly name: string;
}

const EMPLOYEE_FIELDS = ["name", "email", "jobTitle"] as const;

const EmployeeCreateForm = ({
  defaultTeamId,
  triggerLabel = "Add employee",
  teams,
}: {
  readonly defaultTeamId?: string;
  readonly triggerLabel?: string;
  readonly teams: readonly TeamOption[];
}) => {
  const [pending, startTransition] = useTransition();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
  } = useFormErrors(EMPLOYEE_FIELDS);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(
    null
  );
  const create = (formData: FormData) => {
    clearErrors();
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
        showFailure(result.error);
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
        aria-busy={pending || undefined}
        className="panel-b stack"
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          create(new FormData(event.currentTarget));
        }}
      >
        <div className="row">
          <div className="field grow">
            <label htmlFor={`${fieldId}-name`}>Name</label>
            <WorkspaceInput
              autoComplete="name"
              className="input"
              maxLength={120}
              name="name"
              required
              id={`${fieldId}-name`}
              {...fieldProps("name")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="name"
              formId={fieldId}
            />
          </div>
          <div className="field grow">
            <label htmlFor={`${fieldId}-email`}>Work email</label>
            <WorkspaceInput
              autoComplete="email"
              className="input"
              maxLength={254}
              name="email"
              required
              type="email"
              id={`${fieldId}-email`}
              {...fieldProps("email")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="email"
              formId={fieldId}
            />
          </div>
        </div>
        <div className="row">
          <div className="field grow">
            <label htmlFor={`${fieldId}-jobTitle`}>Job title</label>
            <WorkspaceInput
              autoComplete="organization-title"
              className="input"
              maxLength={120}
              name="jobTitle"
              id={`${fieldId}-jobTitle`}
              {...fieldProps("jobTitle")}
            />
            <WorkspaceFieldError
              errors={errors}
              field="jobTitle"
              formId={fieldId}
            />
          </div>
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
        <WorkspaceFormError errors={errors} />
        {temporaryPassword ? (
          <TemporaryPasswordReveal
            note="It is shown once. The employee must change it at sign in."
            password={temporaryPassword}
            title="Temporary password — share it securely now"
          />
        ) : null}
        <div className="acts">
          <WorkspaceButton
            aria-busy={pending || undefined}
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

export { EmployeeCreateForm };

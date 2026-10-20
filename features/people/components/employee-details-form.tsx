/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useTransition } from "react";

import { useFormErrors } from "@/components/workspace/use-form-errors";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceFieldError,
  WorkspaceFormError,
} from "@/components/workspace/workspace-field-error";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import { useWorkspaceUndo } from "@/components/workspace/workspace-undo";
import { updateEmployeeDetailsAction } from "@/features/people/people-actions";

const DETAIL_FIELDS = ["email", "jobTitle", "teamId"] as const;

interface EmployeeDetails {
  readonly id: string;
  readonly email: string;
  readonly jobTitle: string | null;
  readonly teamId: string | null;
}

const EmployeeDetailsForm = ({
  employee,
  teams,
}: {
  readonly employee: EmployeeDetails;
  readonly teams: readonly { readonly id: string; readonly name: string }[];
}) => {
  const [pending, startTransition] = useTransition();
  const { notifySaved } = useWorkspaceUndo();
  const {
    clearErrors,
    errors,
    fieldProps,
    formId: fieldId,
    formRef,
    showFailure,
  } = useFormErrors(DETAIL_FIELDS);

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
        showFailure(result.error);
        return;
      }
      clearErrors();
      notifySaved("Employee details saved");
    });

  return (
    <form
      action={saveDetails}
      aria-busy={pending || undefined}
      className="stack"
      ref={formRef}
    >
      <div className="field">
        <label htmlFor={`${fieldId}-email`}>Login email</label>
        <WorkspaceInput
          autoComplete="email"
          className="input"
          defaultValue={employee.email}
          maxLength={254}
          name="email"
          required
          type="email"
          id={`${fieldId}-email`}
          {...fieldProps("email")}
        />
        <WorkspaceFieldError errors={errors} field="email" formId={fieldId} />
      </div>
      <div className="field">
        <label htmlFor={`${fieldId}-jobTitle`}>Job title</label>
        <WorkspaceInput
          className="input"
          defaultValue={employee.jobTitle ?? ""}
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
      <div className="field">
        <label htmlFor={`${fieldId}-teamId`}>Team</label>
        <WorkspaceSelect
          className="input"
          defaultValue={employee.teamId ?? ""}
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
        <WorkspaceFieldError errors={errors} field="teamId" formId={fieldId} />
      </div>
      <WorkspaceFormError errors={errors} />
      <WorkspaceButton
        aria-busy={pending || undefined}
        className="btn btn-sm btn-secondary"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving…" : "Save details"}
      </WorkspaceButton>
    </form>
  );
};

export { EmployeeDetailsForm };

/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRef, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
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
import {
  hoursToMinutes,
  minutesToHours,
  parseRateToCents,
} from "@/features/projects/budget-format";
import {
  clearProjectBudgetAction,
  saveProjectBudgetAction,
} from "@/features/projects/projects-actions";
import type { ProjectBudgetView } from "@/src/server/budgets/project-budgets";

const FORM_FIELDS = [
  "budgetMinutes",
  "warningPercent",
  "hourlyRateCents",
  "currency",
] as const;
const DEFAULT_WARNING_PERCENT = 80;
const DEFAULT_CURRENCY = "USD";

// Sets, changes or removes a project's hours budget. Only administrators are
// offered it, and the server checks the role again.
export const ProjectBudgetForm = ({
  budget,
  idPrefix,
  onDone,
  projectId,
}: {
  readonly budget: ProjectBudgetView | null;
  readonly idPrefix: string;
  readonly onDone?: () => void;
  readonly projectId: string;
}) => {
  const [pending, startTransition] = useTransition();
  const { clearErrors, errors, fieldProps, formId, formRef, showFailure } =
    useFormErrors(FORM_FIELDS);
  // One key per attempt, so a retried submit cannot save twice.
  const keyRef = useRef<string | null>(null);

  const nextKey = (): string => {
    const key = keyRef.current ?? crypto.randomUUID();
    keyRef.current = key;
    return key;
  };

  const submit = (formData: FormData) => {
    if (pending) {
      return;
    }
    const hours = Number(String(formData.get("hours") ?? ""));
    if (!Number.isFinite(hours) || hours <= 0) {
      showFailure({
        fieldErrors: { budgetMinutes: "Enter the budget in hours." },
        message: "Enter the budget in hours.",
      });
      return;
    }
    const rate = parseRateToCents(String(formData.get("rate") ?? ""));
    if (!rate.ok) {
      showFailure({
        fieldErrors: { hourlyRateCents: "Enter a rate like 90 or 90.50." },
        message: "Enter a rate like 90 or 90.50.",
      });
      return;
    }
    clearErrors();
    const idempotencyKey = nextKey();
    startTransition(async () => {
      const result = await saveProjectBudgetAction({
        billableOnly: formData.get("billableOnly") === "true",
        budgetMinutes: hoursToMinutes(hours),
        currency: String(formData.get("currency") ?? "")
          .trim()
          .toUpperCase(),
        hourlyRateCents: rate.cents,
        idempotencyKey,
        kind: formData.get("kind") === "one_off" ? "one_off" : "retainer",
        projectId,
        warningPercent: Number(formData.get("warningPercent")),
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      keyRef.current = null;
      onDone?.();
    });
  };

  const remove = () => {
    if (pending) {
      return;
    }
    clearErrors();
    const idempotencyKey = nextKey();
    startTransition(async () => {
      const result = await clearProjectBudgetAction({
        idempotencyKey,
        projectId,
      });
      if (!result.ok) {
        showFailure(result.error);
        return;
      }
      keyRef.current = null;
      onDone?.();
    });
  };

  return (
    <form
      action={submit}
      aria-busy={pending || undefined}
      className="budget-form"
      ref={formRef}
    >
      <div className="field">
        <label htmlFor={`${formId}-hours`}>Budget (hours)</label>
        <WorkspaceInput
          autoComplete="off"
          defaultValue={budget ? minutesToHours(budget.budgetMinutes) : ""}
          id={`${formId}-hours`}
          inputMode="decimal"
          min="0.01"
          name="hours"
          required
          step="any"
          type="number"
          {...fieldProps("budgetMinutes")}
        />
        <WorkspaceFieldError
          errors={errors}
          field="budgetMinutes"
          formId={formId}
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-kind`}>Type</label>
        <WorkspaceSelect
          ariaLabel="Budget type"
          className="input"
          defaultValue={budget?.kind ?? "retainer"}
          id={`${formId}-kind`}
          name="kind"
        >
          <WorkspaceSelectItem value="retainer">
            Monthly retainer
          </WorkspaceSelectItem>
          <WorkspaceSelectItem value="one_off">One-off</WorkspaceSelectItem>
        </WorkspaceSelect>
      </div>
      <div className="field">
        <label htmlFor={`${formId}-warningPercent`}>Warn at (%)</label>
        <WorkspaceInput
          defaultValue={budget?.warningPercent ?? DEFAULT_WARNING_PERCENT}
          id={`${formId}-warningPercent`}
          max="100"
          min="1"
          name="warningPercent"
          required
          step="1"
          type="number"
          {...fieldProps("warningPercent")}
        />
        <WorkspaceFieldError
          errors={errors}
          field="warningPercent"
          formId={formId}
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-rate`}>Hourly rate (optional)</label>
        <WorkspaceInput
          autoComplete="off"
          defaultValue={
            budget?.hourlyRateCents === null ||
            budget?.hourlyRateCents === undefined
              ? ""
              : String(budget.hourlyRateCents / 100)
          }
          id={`${formId}-rate`}
          inputMode="decimal"
          name="rate"
          placeholder="90"
          {...fieldProps("hourlyRateCents")}
        />
        <WorkspaceFieldError
          errors={errors}
          field="hourlyRateCents"
          formId={formId}
        />
      </div>
      <div className="field">
        <label htmlFor={`${formId}-currency`}>Currency</label>
        <WorkspaceInput
          autoComplete="off"
          defaultValue={budget?.currency ?? DEFAULT_CURRENCY}
          id={`${formId}-currency`}
          maxLength={3}
          name="currency"
          required
          {...fieldProps("currency")}
        />
        <WorkspaceFieldError errors={errors} field="currency" formId={formId} />
      </div>
      <label className="budget-billable" htmlFor={`${idPrefix}-billable-only`}>
        <Checkbox
          defaultChecked={budget?.billableOnly ?? false}
          id={`${idPrefix}-billable-only`}
          name="billableOnly"
          value="true"
        />
        Count billable time only
      </label>
      <div className="budget-form-actions">
        {budget ? (
          <WorkspaceButton
            className="btn btn-secondary btn-sm"
            disabled={pending}
            onClick={remove}
            type="button"
          >
            Remove budget
          </WorkspaceButton>
        ) : null}
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary btn-sm"
          disabled={pending}
          type="submit"
        >
          Save budget
        </WorkspaceButton>
      </div>
      <WorkspaceFormError errors={errors} />
    </form>
  );
};

/* eslint-disable shadcn/no-restyle */
/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in apps/web/app/workspace-styles. */

"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import {
  createAutomationRuleAction,
  updateAutomationRuleAction,
} from "@/features/projects/automation-actions";
import {
  draftToRuleInput,
  emptyActionDraft,
  emptyConditionDraft,
} from "@/features/projects/automation-form";
import type { RuleDraft } from "@/features/projects/automation-form";
import {
  ActionRow,
  ConditionRow,
} from "@/features/projects/components/automation-rule-fields";
import type { Option } from "@/features/projects/components/automation-rule-fields";
import {
  MAX_ACTIONS_PER_RULE,
  MAX_CONDITIONS_PER_RULE,
} from "@/src/server/automation/automation-contracts";
import {
  AUTOMATION_TRIGGERS,
  AUTOMATION_TRIGGER_LABELS,
} from "@/src/server/automation/automation-model";

export const AutomationRuleForm = ({
  initial,
  labels,
  onClose,
  people,
  projectId,
  rule,
}: {
  readonly initial: RuleDraft;
  readonly labels: readonly Option[];
  readonly onClose: () => void;
  readonly people: readonly Option[];
  readonly projectId: string;
  // Present when editing; its version guards against a concurrent change.
  readonly rule?: { readonly id: string; readonly version: number };
}) => {
  const [draft, setDraft] = useState<RuleDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const converted = draftToRuleInput(draft);
    if (!converted.ok) {
      setError(converted.message);
      return;
    }
    startTransition(async () => {
      const result = rule
        ? await updateAutomationRuleAction({
            ...converted.input,
            expectedVersion: rule.version,
            idempotencyKey: crypto.randomUUID(),
            ruleId: rule.id,
          })
        : await createAutomationRuleAction({
            ...converted.input,
            idempotencyKey: crypto.randomUUID(),
            projectId,
          });
      if (result.ok) {
        onClose();
        return;
      }
      setError(result.error.message);
    });
  };

  return (
    <form
      aria-busy={pending}
      aria-label={rule ? "Edit automation" : "New automation"}
      className="stack"
      noValidate
      onSubmit={submit}
    >
      <label className="field" htmlFor="automation-name">
        <span>Name</span>
        <WorkspaceInput
          className="input"
          disabled={pending}
          id="automation-name"
          maxLength={80}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          required
          value={draft.name}
        />
      </label>
      <div className="field">
        <span id="automation-trigger-label">When</span>
        <WorkspaceSelect
          ariaLabel="Trigger"
          className="input"
          disabled={pending}
          displayValue={AUTOMATION_TRIGGER_LABELS[draft.trigger]}
          onValueChange={(value) => {
            const trigger = AUTOMATION_TRIGGERS.find(
              (candidate) => candidate === value
            );
            if (trigger) {
              setDraft({ ...draft, trigger });
            }
          }}
          value={draft.trigger}
        >
          {AUTOMATION_TRIGGERS.map((trigger) => (
            <WorkspaceSelectItem key={trigger} value={trigger}>
              {AUTOMATION_TRIGGER_LABELS[trigger]}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </div>
      <div className="stack">
        {draft.conditions.map((condition, index) => (
          <ConditionRow
            condition={condition}
            index={index}
            key={condition.key}
            labels={labels}
            onChange={(next) =>
              setDraft({
                ...draft,
                conditions: draft.conditions.map((candidate) =>
                  candidate.key === next.key ? next : candidate
                ),
              })
            }
            onRemove={() =>
              setDraft({
                ...draft,
                conditions: draft.conditions.filter(
                  (candidate) => candidate.key !== condition.key
                ),
              })
            }
            pending={pending}
            people={people}
          />
        ))}
        <div className="row">
          <WorkspaceButton
            className="btn btn-secondary btn-sm"
            disabled={
              pending || draft.conditions.length >= MAX_CONDITIONS_PER_RULE
            }
            onClick={() =>
              setDraft({
                ...draft,
                conditions: [...draft.conditions, emptyConditionDraft()],
              })
            }
            type="button"
          >
            Add condition
          </WorkspaceButton>
          <span className="muted">
            Optional. Every condition must hold for the rule to run.
          </span>
        </div>
      </div>
      <div className="stack">
        {draft.actions.map((action, index) => (
          <ActionRow
            action={action}
            index={index}
            key={action.key}
            labels={labels}
            onChange={(next) =>
              setDraft({
                ...draft,
                actions: draft.actions.map((candidate) =>
                  candidate.key === next.key ? next : candidate
                ),
              })
            }
            onRemove={() =>
              setDraft({
                ...draft,
                actions: draft.actions.filter(
                  (candidate) => candidate.key !== action.key
                ),
              })
            }
            pending={pending}
            people={people}
          />
        ))}
        <div className="row">
          <WorkspaceButton
            className="btn btn-secondary btn-sm"
            disabled={pending || draft.actions.length >= MAX_ACTIONS_PER_RULE}
            onClick={() =>
              setDraft({
                ...draft,
                actions: [...draft.actions, emptyActionDraft("set_priority")],
              })
            }
            type="button"
          >
            Add action
          </WorkspaceButton>
          <span className="muted">
            Up to {MAX_ACTIONS_PER_RULE} actions, run in order.
          </span>
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      <div className="row">
        <WorkspaceButton
          aria-busy={pending || undefined}
          className="btn btn-primary btn-sm"
          disabled={pending}
          type="submit"
        >
          {pending ? "Saving…" : "Save automation"}
        </WorkspaceButton>
        <WorkspaceButton
          className="btn btn-secondary btn-sm"
          disabled={pending}
          onClick={onClose}
          type="button"
        >
          Cancel
        </WorkspaceButton>
      </div>
    </form>
  );
};

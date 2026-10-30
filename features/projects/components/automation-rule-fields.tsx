/* eslint-disable shadcn/no-restyle */
/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in apps/web/app/workspace-styles. */

"use client";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  WorkspaceInput,
  WorkspaceTextarea,
} from "@/components/workspace/workspace-controls";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import {
  ACTION_TYPE_LABELS,
  CONDITION_FIELD_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
} from "@/features/projects/automation-form";
import type {
  ActionDraft,
  ConditionDraft,
} from "@/features/projects/automation-form";
import {
  ACTION_TYPES,
  CONDITION_FIELDS,
} from "@/src/server/automation/automation-model";
import type {
  ActionType,
  ConditionField,
} from "@/src/server/automation/automation-model";

export interface Option {
  readonly id: string;
  readonly label: string;
}

const entriesOf = (labels: Readonly<Record<string, string>>): Option[] =>
  Object.entries(labels).map(([id, label]) => ({ id, label }));

const optionsFor = (
  field: ConditionField,
  people: readonly Option[],
  labels: readonly Option[]
): readonly Option[] => {
  switch (field) {
    case "status": {
      return entriesOf(STATUS_LABELS);
    }
    case "priority": {
      return entriesOf(PRIORITY_LABELS);
    }
    case "taskType": {
      return entriesOf(TASK_TYPE_LABELS);
    }
    case "assignee": {
      return people;
    }
    case "label": {
      return labels;
    }
    default: {
      const unhandled: never = field;
      return unhandled;
    }
  }
};

const displayProps = (
  options: readonly Option[],
  value: string,
  placeholder: string | undefined
): { readonly displayValue?: string } => {
  const label =
    options.find((option) => option.id === value)?.label ?? placeholder;
  return label === undefined ? {} : { displayValue: label };
};

const OptionSelect = ({
  ariaLabel,
  disabled,
  onChange,
  options,
  placeholder,
  value,
}: {
  readonly ariaLabel: string;
  readonly disabled: boolean;
  readonly onChange: (value: string) => void;
  readonly options: readonly Option[];
  readonly placeholder?: string;
  readonly value: string;
}) => (
  <WorkspaceSelect
    ariaLabel={ariaLabel}
    className="input"
    disabled={disabled}
    {...displayProps(options, value, placeholder)}
    onValueChange={onChange}
    value={value}
  >
    {options.map((option) => (
      <WorkspaceSelectItem key={option.id} value={option.id}>
        {option.label}
      </WorkspaceSelectItem>
    ))}
  </WorkspaceSelect>
);

export const ConditionRow = ({
  condition,
  index,
  labels,
  onChange,
  onRemove,
  pending,
  people,
}: {
  readonly condition: ConditionDraft;
  readonly index: number;
  readonly labels: readonly Option[];
  readonly onChange: (next: ConditionDraft) => void;
  readonly onRemove: () => void;
  readonly pending: boolean;
  readonly people: readonly Option[];
}) => {
  const position = index + 1;
  const options = optionsFor(condition.field, people, labels);
  const selected = new Set(condition.values);
  return (
    <fieldset className="field" data-automation-condition={position}>
      <legend>Condition {position}</legend>
      <div className="row">
        <OptionSelect
          ariaLabel={`Condition ${position} field`}
          disabled={pending}
          onChange={(field) => {
            const next = CONDITION_FIELDS.find((value) => value === field);
            if (next) {
              onChange({ ...condition, field: next, values: [] });
            }
          }}
          options={CONDITION_FIELDS.map((field) => ({
            id: field,
            label: CONDITION_FIELD_LABELS[field],
          }))}
          value={condition.field}
        />
        <OptionSelect
          ariaLabel={`Condition ${position} operator`}
          disabled={pending}
          onChange={(op) =>
            onChange({ ...condition, op: op === "not_in" ? "not_in" : "in" })
          }
          options={[
            { id: "in", label: "is" },
            { id: "not_in", label: "is not" },
          ]}
          value={condition.op}
        />
        <WorkspaceButton
          aria-label={`Remove condition ${position}`}
          className="btn btn-danger-ghost btn-sm"
          disabled={pending}
          onClick={onRemove}
          type="button"
        >
          Remove
        </WorkspaceButton>
      </div>
      {options.length === 0 ? (
        <p className="muted">Nothing to choose from yet.</p>
      ) : (
        <div className="row">
          {options.map((option) => (
            <label className="row" key={option.id}>
              <input
                checked={selected.has(option.id)}
                disabled={pending}
                onChange={(event) =>
                  onChange({
                    ...condition,
                    values: event.target.checked
                      ? [...condition.values, option.id]
                      : condition.values.filter((value) => value !== option.id),
                  })
                }
                type="checkbox"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
};

export const ActionRow = ({
  action,
  index,
  labels,
  onChange,
  onRemove,
  pending,
  people,
}: {
  readonly action: ActionDraft;
  readonly index: number;
  readonly labels: readonly Option[];
  readonly onChange: (next: ActionDraft) => void;
  readonly onRemove: () => void;
  readonly pending: boolean;
  readonly people: readonly Option[];
}) => {
  const position = index + 1;
  const personPicker = (
    <OptionSelect
      ariaLabel={`Action ${position} person`}
      disabled={pending}
      onChange={(userId) => onChange({ ...action, userId })}
      options={people}
      placeholder="Choose a person"
      value={action.userId}
    />
  );
  return (
    <fieldset className="field" data-automation-action={position}>
      <legend>Action {position}</legend>
      <div className="row">
        <OptionSelect
          ariaLabel={`Action ${position} type`}
          disabled={pending}
          onChange={(type) => {
            const next: ActionType | undefined = ACTION_TYPES.find(
              (value) => value === type
            );
            if (next) {
              onChange({ ...action, type: next });
            }
          }}
          options={ACTION_TYPES.map((type) => ({
            id: type,
            label: ACTION_TYPE_LABELS[type],
          }))}
          value={action.type}
        />
        {action.type === "set_status" ? (
          <OptionSelect
            ariaLabel={`Action ${position} status`}
            disabled={pending}
            onChange={(status) => onChange({ ...action, status })}
            options={entriesOf(STATUS_LABELS)}
            value={action.status}
          />
        ) : null}
        {action.type === "set_priority" ? (
          <OptionSelect
            ariaLabel={`Action ${position} priority`}
            disabled={pending}
            onChange={(priority) => onChange({ ...action, priority })}
            options={entriesOf(PRIORITY_LABELS)}
            value={action.priority}
          />
        ) : null}
        {action.type === "assign" ||
        action.type === "unassign" ||
        action.type === "notify"
          ? personPicker
          : null}
        {action.type === "add_label" ? (
          <OptionSelect
            ariaLabel={`Action ${position} label`}
            disabled={pending}
            onChange={(labelId) => onChange({ ...action, labelId })}
            options={labels}
            placeholder="Choose a label"
            value={action.labelId}
          />
        ) : null}
        <WorkspaceButton
          aria-label={`Remove action ${position}`}
          className="btn btn-danger-ghost btn-sm"
          disabled={pending}
          onClick={onRemove}
          type="button"
        >
          Remove
        </WorkspaceButton>
      </div>
      {action.type === "post_comment" ? (
        <label className="field" htmlFor={`${action.key}-body`}>
          <span>Internal comment (never shown to clients)</span>
          <WorkspaceTextarea
            className="input"
            disabled={pending}
            id={`${action.key}-body`}
            maxLength={1000}
            onChange={(event) =>
              onChange({ ...action, body: event.target.value })
            }
            rows={3}
            value={action.body}
          />
        </label>
      ) : null}
      {action.type === "notify" ? (
        <label className="field" htmlFor={`${action.key}-message`}>
          <span>Message</span>
          <WorkspaceInput
            className="input"
            disabled={pending}
            id={`${action.key}-message`}
            maxLength={200}
            onChange={(event) =>
              onChange({ ...action, message: event.target.value })
            }
            value={action.message}
          />
        </label>
      ) : null}
    </fieldset>
  );
};

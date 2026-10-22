/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDatePicker } from "@/components/workspace/workspace-date-picker";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import type { TaskCustomField } from "@/src/server/custom-fields/custom-field-contracts";
import { MAX_FIELD_VALUE_LENGTH } from "@/src/server/custom-fields/custom-field-values";
import type { FieldValue } from "@/src/server/custom-fields/custom-field-values";

// The input for one field's type. It reports a finished edit through onSave:
// null clears the value. Text and numbers save when the person leaves the
// input; a choice, date or checkbox saves as soon as it changes.
export const CustomFieldControl = ({
  describedBy,
  disabled,
  field,
  id,
  invalid,
  onSave,
}: {
  readonly describedBy: string | undefined;
  readonly disabled: boolean;
  readonly field: TaskCustomField;
  readonly id: string;
  readonly invalid: boolean;
  readonly onSave: (value: FieldValue | null) => void;
}) => {
  const { value } = field;
  switch (field.type) {
    case "text": {
      return (
        <WorkspaceInput
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          defaultValue={typeof value === "string" ? value : ""}
          disabled={disabled}
          id={id}
          maxLength={MAX_FIELD_VALUE_LENGTH}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim();
            if (next !== (value ?? "")) {
              onSave(next === "" ? null : next);
            }
          }}
          type="text"
        />
      );
    }
    case "number": {
      return (
        <WorkspaceInput
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          defaultValue={typeof value === "number" ? String(value) : ""}
          disabled={disabled}
          id={id}
          inputMode="decimal"
          onBlur={(event) => {
            const text = event.currentTarget.value.trim();
            const next = text === "" ? null : Number(text);
            if (next !== value) {
              onSave(next);
            }
          }}
          type="number"
        />
      );
    }
    case "select": {
      return (
        <WorkspaceSelect
          ariaInvalid={invalid}
          ariaLabel={field.name}
          disabled={disabled}
          displayValue={typeof value === "string" ? value : "Not set"}
          id={id}
          onValueChange={(next) => onSave(next === "" ? null : next)}
          value={typeof value === "string" ? value : ""}
        >
          <WorkspaceSelectItem value="">Not set</WorkspaceSelectItem>
          {field.options.map((option) => (
            <WorkspaceSelectItem key={option} value={option}>
              {option}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      );
    }
    case "date": {
      return (
        <WorkspaceDatePicker
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          ariaLabel={field.name}
          disabled={disabled}
          id={id}
          onValueChange={(next) => onSave(next === "" ? null : next)}
          value={typeof value === "string" ? value : ""}
        />
      );
    }
    case "checkbox": {
      return (
        <input
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          checked={value === true}
          disabled={disabled}
          id={id}
          onChange={(event) => onSave(event.currentTarget.checked)}
          type="checkbox"
        />
      );
    }
    default: {
      const unreachable: never = field.type;
      return unreachable;
    }
  }
};

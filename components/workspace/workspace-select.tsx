"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_VALUE = "__taskora_empty_select_value__";

const WorkspaceSelect = ({
  ariaInvalid,
  ariaDescribedby,
  ariaLabel,
  children,
  className,
  defaultValue,
  dataField,
  disabled,
  displayValue,
  id,
  name,
  onValueChange,
  required,
  status,
  value,
}: {
  readonly ariaInvalid?: boolean | "false" | "grammar" | "spelling" | "true";
  readonly ariaDescribedby?: string;
  readonly ariaLabel?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly defaultValue?: string;
  readonly dataField?: string;
  readonly disabled?: boolean;
  readonly displayValue?: string;
  readonly id?: string;
  readonly name?: string;
  readonly onValueChange?: (value: string) => void;
  readonly required?: boolean;
  readonly status?: "backlog" | "todo" | "progress" | "review" | "done";
  readonly value?: string;
}) => {
  const initialValue = value ?? defaultValue ?? "";
  const [selectedValue, setSelectedValue] = useState(
    initialValue || EMPTY_VALUE
  );
  const formInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const form = formInput.current?.form;
    if (!form) {
      return;
    }
    const reset = () => setSelectedValue(initialValue || EMPTY_VALUE);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initialValue]);

  const currentValue =
    value === undefined ? selectedValue : value || EMPTY_VALUE;
  return (
    <>
      <Select
        {...(disabled === undefined ? {} : { disabled })}
        {...(required === undefined ? {} : { required })}
        onValueChange={(nextValue) => {
          if (value === undefined) {
            setSelectedValue(nextValue);
          }
          onValueChange?.(nextValue === EMPTY_VALUE ? "" : nextValue);
        }}
        value={currentValue}
      >
        <SelectTrigger
          aria-describedby={ariaDescribedby}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-required={required || undefined}
          className={className}
          data-field={dataField}
          data-status={status}
          id={id}
        >
          <SelectValue>{displayValue}</SelectValue>
        </SelectTrigger>
        <SelectContent data-workspace-select="">{children}</SelectContent>
      </Select>
      {name ? (
        <input
          disabled={disabled}
          name={name}
          ref={formInput}
          type="hidden"
          value={currentValue === EMPTY_VALUE ? "" : currentValue}
        />
      ) : null}
    </>
  );
};

const WorkspaceSelectItem = ({
  children,
  value,
  ...props
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly value: string;
}) => (
  <SelectItem value={value || EMPTY_VALUE} {...props}>
    {children}
  </SelectItem>
);

export { WorkspaceSelect, WorkspaceSelectItem };

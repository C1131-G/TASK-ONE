"use client";

import { CaretDown } from "@phosphor-icons/react";
import { cn } from "cn";
import { useEffect, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

interface WorkspaceComboboxProps {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly defaultValue?: string;
  readonly disabled?: boolean;
  readonly emptyMessage: string;
  readonly id: string;
  readonly name?: string;
  readonly onValueChange?: (value: string) => void;
  readonly options: readonly {
    readonly label: string;
    readonly value: string;
  }[];
  readonly placeholder: string;
  readonly searchPlaceholder: string;
  readonly value?: string;
}

const EMPTY_VALUE = "__taskora_empty_combobox_value__";

const WorkspaceCombobox = ({
  ariaLabel,
  className,
  defaultValue,
  disabled,
  emptyMessage,
  id,
  name,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  value,
}: WorkspaceComboboxProps) => {
  const [open, setOpen] = useState(false);
  const [localValue, setLocalValue] = useState(value ?? defaultValue ?? "");
  const hiddenInput = useRef<HTMLInputElement>(null);
  const selectedValue = value ?? localValue;
  const selectedOption = options.find(
    (option) => option.value === selectedValue
  );

  useEffect(() => {
    const form = hiddenInput.current?.form;
    if (!form) {
      return;
    }
    const reset = () => setLocalValue(defaultValue ?? "");
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <WorkspaceButton
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label={`${ariaLabel}: ${selectedOption?.label ?? placeholder}`}
          aria-controls={`${id}-options`}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
          workspace
        >
          <span className="truncate">
            {selectedOption?.label ?? placeholder}
          </span>
          <CaretDown aria-hidden="true" size={16} />
        </WorkspaceButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)]"
        data-workspace-combobox=""
        data-workspace-menu=""
      >
        <Command>
          <CommandInput
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
          />
          <CommandList id={`${id}-options`}>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  data-checked={option.value === selectedValue}
                  key={option.value}
                  keywords={[option.label]}
                  onSelect={() => {
                    if (value === undefined) {
                      setLocalValue(option.value);
                    }
                    onValueChange?.(option.value);
                    setOpen(false);
                  }}
                  value={option.value || EMPTY_VALUE}
                >
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
      {name ? (
        <input
          name={name}
          ref={hiddenInput}
          type="hidden"
          value={selectedValue}
        />
      ) : null}
    </Popover>
  );
};

export { WorkspaceCombobox };

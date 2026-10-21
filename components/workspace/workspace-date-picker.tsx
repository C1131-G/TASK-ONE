"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { format, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const toDate = (value: string | undefined) =>
  value ? parseISO(`${value.slice(0, 10)}T00:00:00`) : undefined;

const toDateValue = (date: Date | undefined) => {
  if (!date) {
    return "";
  }
  const year = date.getFullYear().toString().padStart(4, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const WorkspaceDatePicker = ({
  ariaLabel,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  className,
  defaultValue,
  disabled,
  id,
  name,
  onValueChange,
  required,
  value,
}: {
  readonly ariaLabel?: string;
  // Inline validation: the trigger is the control a field error describes.
  readonly "aria-describedby"?: string | undefined;
  readonly "aria-invalid"?: boolean | undefined;
  readonly className?: string;
  readonly defaultValue?: string | null;
  readonly disabled?: boolean;
  readonly id?: string;
  readonly name?: string;
  readonly onValueChange?: (value: string) => void;
  readonly required?: boolean;
  readonly value?: string | null;
}) => {
  const initialValue = value ?? defaultValue ?? "";
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const [open, setOpen] = useState(false);
  const formInput = useRef<HTMLInputElement>(null);
  const currentValue = value === undefined ? selectedValue : (value ?? "");
  const selectedDate = toDate(currentValue);

  useEffect(() => {
    const form = formInput.current?.form;
    if (!form) {
      return;
    }
    const reset = () => setSelectedValue(initialValue);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [initialValue]);

  const updateValue = (date: Date | undefined) => {
    const nextValue = toDateValue(date);
    if (value === undefined) {
      setSelectedValue(nextValue);
    }
    onValueChange?.(nextValue);
    setOpen(false);
  };

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-describedby={ariaDescribedBy}
            aria-invalid={ariaInvalid}
            aria-label={ariaLabel}
            aria-required={required || undefined}
            className={cn("w-full justify-between", className)}
            data-workspace-date-trigger=""
            disabled={disabled}
            id={id}
            type="button"
            variant="outline"
          >
            {selectedDate ? format(selectedDate, "MMM d, yyyy") : "Pick a date"}
            <CalendarBlank aria-hidden="true" size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto" data-workspace-menu="">
          <Calendar
            mode="single"
            onSelect={updateValue}
            selected={selectedDate}
          />
        </PopoverContent>
      </Popover>
      {name ? (
        <input
          aria-hidden="true"
          name={name}
          ref={formInput}
          tabIndex={-1}
          type="hidden"
          value={currentValue}
        />
      ) : null}
    </>
  );
};

export { WorkspaceDatePicker };

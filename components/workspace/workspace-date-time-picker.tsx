"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { format, isValid, parseISO } from "date-fns";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  hour.toString().padStart(2, "0")
);
const DEFAULT_MINUTE_OPTIONS = ["00", "15", "30", "45"];

const parseLocalDateTime = (value: string | undefined) => {
  if (!value) {
    return { date: undefined, time: "" };
  }
  const parsed = parseISO(value);
  if (!isValid(parsed)) {
    return { date: undefined, time: "" };
  }
  return { date: parsed, time: format(parsed, "HH:mm") };
};

const toLocalDateTime = (date: Date | undefined, time: string) => {
  if (!date || !time) {
    return "";
  }
  return `${format(date, "yyyy-MM-dd")}T${time}`;
};

const WorkspaceDateTimePicker = ({
  ariaLabel,
  className,
  defaultValue,
  id,
  name,
  required,
}: {
  readonly ariaLabel: string;
  readonly className?: string;
  readonly defaultValue?: string;
  readonly id: string;
  readonly name: string;
  readonly required?: boolean;
}) => {
  const initial = parseLocalDateTime(defaultValue);
  const [date, setDate] = useState<Date | undefined>(initial.date);
  const [time, setTime] = useState(initial.time);
  const [open, setOpen] = useState(false);
  const formInput = useRef<HTMLInputElement>(null);
  const currentValue = toLocalDateTime(date, time);
  const [hour = "", minute = ""] = time.split(":");
  const minuteOptions = DEFAULT_MINUTE_OPTIONS.includes(minute)
    ? DEFAULT_MINUTE_OPTIONS
    : [...DEFAULT_MINUTE_OPTIONS, minute].toSorted();

  useEffect(() => {
    const form = formInput.current?.form;
    if (!form) {
      return;
    }
    const reset = () => {
      const next = parseLocalDateTime(defaultValue);
      setDate(next.date);
      setTime(next.time);
    };
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, [defaultValue]);

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-label={ariaLabel}
            aria-required={required || undefined}
            className={cn("w-full justify-between", className)}
            data-workspace-date-trigger=""
            id={id}
            type="button"
            variant="outline"
          >
            {date && time
              ? `${format(date, "MMM d, yyyy")} · ${format(parseISO(`2000-01-01T${time}`), "h:mm a")}`
              : "Pick date and time"}
            <CalendarBlank aria-hidden="true" size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto" data-workspace-menu="">
          <div className="grid gap-2">
            <Calendar mode="single" onSelect={setDate} selected={date} />
            <div className="grid grid-cols-2 gap-2 px-3 pb-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor={`${id}-hour`}>
                  Hour
                </label>
                <Select
                  onValueChange={(nextHour) =>
                    setTime(`${nextHour}:${minute || "00"}`)
                  }
                  value={hour}
                >
                  <SelectTrigger
                    aria-label={`${ariaLabel} hour`}
                    className="w-full"
                    id={`${id}-hour`}
                  >
                    <SelectValue placeholder="Hour" />
                  </SelectTrigger>
                  <SelectContent data-workspace-menu="">
                    {HOUR_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {format(parseISO(`2000-01-01T${option}:00`), "h a")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor={`${id}-minute`}>
                  Minute
                </label>
                <Select
                  onValueChange={(nextMinute) =>
                    setTime(`${hour || "00"}:${nextMinute}`)
                  }
                  value={minute}
                >
                  <SelectTrigger
                    aria-label={`${ariaLabel} minute`}
                    className="w-full"
                    id={`${id}-minute`}
                  >
                    <SelectValue placeholder="Minute" />
                  </SelectTrigger>
                  <SelectContent data-workspace-menu="">
                    {minuteOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-3 pb-2">
              {currentValue ? (
                <Button
                  onClick={() => {
                    setDate(undefined);
                    setTime("");
                  }}
                  type="button"
                  variant="ghost"
                >
                  Clear
                </Button>
              ) : null}
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="ghost"
              >
                Done
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <input
        aria-hidden="true"
        name={name}
        ref={formInput}
        tabIndex={-1}
        type="hidden"
        value={currentValue}
      />
    </>
  );
};

export { WorkspaceDateTimePicker };

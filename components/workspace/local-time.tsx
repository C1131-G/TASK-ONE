"use client";

import { useHydrated } from "@/components/workspace/use-hydrated";
import { formatDate, formatDateTime, formatRelative } from "@/lib/format-date";
import type { DateInput } from "@/lib/format-date";

type LocalTimeFormat = "date" | "dateTime" | "relative";

const formatIn = (
  value: DateInput,
  format: LocalTimeFormat,
  timeZone: string | undefined
): string => {
  if (format === "date") {
    return formatDate(value, timeZone);
  }
  if (format === "dateTime") {
    return formatDateTime(value, timeZone);
  }
  // Relative text depends on the moment it renders, so the server and the
  // hydrating client show the date and only the hydrated client counts.
  return timeZone
    ? formatDate(value, timeZone)
    : formatRelative(value, new Date());
};

// Server render and hydration use UTC so the markup always matches; once
// hydrated, the text switches to the viewer's own time zone.
const LocalTime = ({
  className,
  format = "dateTime",
  value,
}: {
  readonly className?: string;
  readonly format?: LocalTimeFormat;
  readonly value: DateInput;
}) => {
  const timeZone = useHydrated() ? undefined : "UTC";
  const text = formatIn(value, format, timeZone);
  if (!text) {
    return null;
  }
  const machineValue = typeof value === "string" ? value : value.toISOString();
  return (
    <time
      className={className}
      dateTime={machineValue}
      title={
        format === "relative" ? formatDateTime(value, timeZone) : undefined
      }
    >
      {text}
    </time>
  );
};

export { LocalTime };
export type { LocalTimeFormat };

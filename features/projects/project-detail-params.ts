import {
  parseCalendarMode,
  parseMonthOffset,
} from "@/features/calendar/calendar-params";
import type { ProjectDetailQuery } from "@/features/projects/project-detail-data";

type RawSearchParams = Readonly<Record<string, string | string[] | undefined>>;

// ?view names a built-in view or "saved-<id>"; the board is the default.
const parseProjectDetailQuery = (
  params: RawSearchParams
): ProjectDetailQuery => {
  const { view } = params;
  return {
    calendarMode: parseCalendarMode(params["calendarMode"]),
    monthOffset: parseMonthOffset(params["monthOffset"]),
    view: typeof view === "string" && view ? view : "board",
  };
};

export { parseProjectDetailQuery };

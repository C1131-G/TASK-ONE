/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  parseCalendarMode,
  parseMonthOffset,
} from "@/features/calendar/calendar-params";
import {
  CalendarView,
  CalendarViewSkeleton,
} from "@/features/calendar/components/calendar-view";

export const metadata: Metadata = { title: "Calendar | Metsys" };

const CalendarPage = ({ searchParams }: PageProps<"/calendar">) => (
  <div className="page">
    <SectionErrorBoundary title="calendar could not be loaded">
      <Suspense fallback={<CalendarViewSkeleton />}>
        {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
        {searchParams.then((params) => (
          <CalendarView
            monthOffset={parseMonthOffset(params["monthOffset"])}
            viewMode={parseCalendarMode(params["calendarMode"])}
          />
        ))}
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default CalendarPage;

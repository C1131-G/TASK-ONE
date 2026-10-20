/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
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
  <PageTransition>
    <div className="page">
      <SectionErrorBoundary title="calendar could not be loaded">
        <SuspenseReveal fallback={<CalendarViewSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <CalendarView
              monthOffset={parseMonthOffset(params["monthOffset"])}
              viewMode={parseCalendarMode(params["calendarMode"])}
            />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default CalendarPage;

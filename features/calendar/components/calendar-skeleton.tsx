/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the task calendar markup. */

import {
  CaretLeft,
  CaretRight,
  FunnelSimple,
} from "@phosphor-icons/react/dist/ssr";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
const CALENDAR_DAYS = SKELETON_KEYS.slice(0, 35);

// Mirrors TaskCalendarGrid: toolbar, navigation and weekday names are static;
// the month, legend and every day cell are data.
const CalendarGridSkeleton = () => (
  <section className="panel cal workspace-calendar">
    <div className="toolbar calendar-toolbar" inert>
      <span className="skeleton-filter-select skeleton-search">
        Search tasks
      </span>
      <span className="btn btn-sm btn-outline">
        <FunnelSimple aria-hidden="true" size={16} /> Filter
      </span>
      <span className="btn btn-sm btn-ghost">Sort: Manual</span>
    </div>
    <div className="toolbar calendar-navigation-toolbar" inert>
      <span className="btn btn-sm btn-outline">Today</span>
      <div className="row calendar-nav">
        <span className="ibtn">
          <CaretLeft aria-hidden="true" size={16} />
        </span>
        <span className="ibtn">
          <CaretRight aria-hidden="true" size={16} />
        </span>
      </div>
      <h2 className="calendar-month-label">
        <SkeletonBone shape="title" />
      </h2>
      <div className="calendar-project-legend skeleton-legend">
        <SkeletonBone shape="short" />
        <SkeletonBone shape="short" />
      </div>
      <div className="calendar-view-toggle">
        <span className="btn btn-sm btn-primary">Month</span>
        <span className="btn btn-sm btn-outline">Week</span>
      </div>
    </div>
    <div aria-hidden="true" className="cal-h">
      {WEEKDAYS.map((day) => (
        <div key={day}>{day}</div>
      ))}
    </div>
    <SkelterSurface label="Loading calendar…">
      <div className="cal-g workspace-calendar-grid">
        {CALENDAR_DAYS.map((key) => (
          <div className="cday" key={key}>
            <span className="dn">
              <SkeletonBone shape="short" />
            </span>
          </div>
        ))}
      </div>
    </SkelterSurface>
  </section>
);

export { CalendarGridSkeleton };

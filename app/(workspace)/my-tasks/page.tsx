/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  parseCalendarMode,
  parseMonthOffset,
} from "@/features/calendar/calendar-params";
import { MyTasks, MyTasksSkeleton } from "@/features/tasks/components/my-tasks";
import { parseTaskIdParam } from "@/features/tasks/task-param";

export const metadata: Metadata = { title: "My Tasks | Metsys" };

const MyTasksPage = ({ searchParams }: PageProps<"/my-tasks">) => (
  <PageTransition>
    <div className="page flush">
      <SectionErrorBoundary title="My tasks couldn't load">
        <SuspenseReveal fallback={<MyTasksSkeleton />}>
          {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
          {searchParams.then((params) => (
            <MyTasks
              calendarMode={parseCalendarMode(params["calendarMode"])}
              initialTaskId={parseTaskIdParam(params["task"])}
              monthOffset={parseMonthOffset(params["monthOffset"])}
            />
          ))}
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default MyTasksPage;

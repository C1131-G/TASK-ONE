/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  parseCalendarMode,
  parseMonthOffset,
} from "@/features/calendar/calendar-params";
import { MyTasks, MyTasksSkeleton } from "@/features/tasks/components/my-tasks";
import { parseTaskIdParam } from "@/features/tasks/task-param";

export const metadata: Metadata = { title: "My Tasks | Metsys" };
export const instant = false;

const MyTasksPage = ({ searchParams }: PageProps<"/my-tasks">) => (
  <div className="page flush">
    <Suspense fallback={<MyTasksSkeleton />}>
      {/* oxlint-disable-next-line promise/prefer-await-to-then -- The page stays synchronous so its chrome paints in the static shell. */}
      {searchParams.then((params) => (
        <MyTasks
          calendarMode={parseCalendarMode(params["calendarMode"])}
          initialTaskId={parseTaskIdParam(params["task"])}
          monthOffset={parseMonthOffset(params["monthOffset"])}
        />
      ))}
    </Suspense>
  </div>
);

export default MyTasksPage;

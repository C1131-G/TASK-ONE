/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listTaskCalendarAction } from "@/app/actions/task-calendar";
import { WorkspaceTimeline } from "@/components/workspace/workspace-timeline";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";

export const metadata: Metadata = { title: "Timeline | Metsys" };

const TimelinePage = async () => {
  await connection();
  const range = currentUtcMonthRange(0, 4);
  const result = await listTaskCalendarAction({
    from: range.from,
    groupBy: "project",
    limit: 200,
    priorities: [],
    sortBy: "startDate",
    sortDirection: "asc",
    statuses: [],
    to: range.to,
  });
  if (!result.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Timeline could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }
  const items = result.data.filter((task) => task.startDate || task.dueDate);
  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>Timeline</h1>
          <p>Task dates for the next four months.</p>
        </div>
      </div>
      <WorkspaceTimeline from={range.from} tasks={items} to={range.to} />
    </div>
  );
};

export default TimelinePage;

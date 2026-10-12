/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { connection } from "next/server";

import { listEmployeesAction } from "@/app/actions/employees";
import { listTaskCalendarAction } from "@/app/actions/task-calendar";
import { WorkspaceTimeline } from "@/components/workspace/workspace-timeline";
import { currentUtcMonthRange } from "@/src/lib/utc-date-range";

export const metadata: Metadata = { title: "Timeline | Metsys" };

const TimelinePage = async () => {
  await connection();
  const range = currentUtcMonthRange(0, 4);
  const [result, peopleResult] = await Promise.all([
    listTaskCalendarAction({
      from: range.from,
      groupBy: "project",
      limit: 200,
      priorities: [],
      sortBy: "startDate",
      sortDirection: "asc",
      statuses: [],
      to: range.to,
    }),
    listEmployeesAction({ search: "" }),
  ]);
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
          <p>Search, filter, and schedule work across active projects.</p>
        </div>
      </div>
      <WorkspaceTimeline
        employees={
          peopleResult.ok
            ? peopleResult.data.map(({ id, name }) => ({ id, name }))
            : []
        }
        from={range.from}
        tasks={items}
        to={range.to}
      />
    </div>
  );
};

export default TimelinePage;

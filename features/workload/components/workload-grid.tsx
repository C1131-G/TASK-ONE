/* eslint-disable shadcn/no-unknown-classes */

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import {
  hoursLabel,
  taskCountLabel,
  weekLabel,
} from "@/features/workload/workload-format";
import { getWorkload } from "@/features/workload/workload-queries";
import { readOrThrow } from "@/lib/read-result";

// One row per teammate, one column per week: how much is due and how many
// estimated hours it adds up to. A week over the threshold says so in words.
const WorkloadGrid = async () => {
  const result = await getWorkload({});
  const workload = readOrThrow(result, "Workload");
  if (workload.people.length === 0) {
    return (
      <section className="panel panel-b">
        <p className="muted">No teammates to show yet.</p>
      </section>
    );
  }
  return (
    <section aria-label="Team workload" className="workload">
      <p className="muted workload-note">
        A week is over capacity when more than {workload.capacityHours} hours of
        estimated work is due in it. Overdue tasks count toward this week; tasks
        without an estimate are weighted by priority.
      </p>
      <div className="tbl-wrap">
        <table className="tbl workload-table">
          <caption className="sr-only">
            Open tasks and estimated hours due per person, by week
          </caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              {workload.weeks.map((weekStart) => (
                <th key={weekStart} scope="col">
                  <span className="sr-only">Week of </span>
                  {weekLabel(weekStart)}
                </th>
              ))}
              <th scope="col">No due date</th>
            </tr>
          </thead>
          <tbody>
            {workload.people.map((person) => (
              <tr key={person.userId}>
                <th scope="row">
                  <span>{person.name}</span>
                  {person.overdueCount > 0 ? (
                    <span className="workload-overdue">
                      {person.overdueCount} overdue
                    </span>
                  ) : null}
                </th>
                {person.weeks.map((week) => (
                  <td
                    className="workload-cell"
                    data-overloaded={week.overloaded}
                    key={week.weekStart}
                  >
                    {week.taskCount === 0 ? (
                      <span className="workload-empty">
                        <span aria-hidden="true">–</span>
                        <span className="sr-only">No tasks</span>
                      </span>
                    ) : (
                      <>
                        <strong>{hoursLabel(week.loadHours)}</strong>
                        <span className="workload-count">
                          {taskCountLabel(week.taskCount)}
                        </span>
                        {week.overloaded ? (
                          <span className="workload-flag">Over capacity</span>
                        ) : null}
                      </>
                    )}
                  </td>
                ))}
                <td className="workload-cell">
                  {person.unscheduled.taskCount === 0 ? (
                    <span className="workload-empty">
                      <span aria-hidden="true">–</span>
                      <span className="sr-only">No tasks</span>
                    </span>
                  ) : (
                    <>
                      <strong>
                        {hoursLabel(person.unscheduled.loadHours)}
                      </strong>
                      <span className="workload-count">
                        {taskCountLabel(person.unscheduled.taskCount)}
                      </span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const WorkloadGridSkeleton = () => (
  <PanelSkeleton label="Loading workload…" rows={5} variant="list" />
);

export { WorkloadGrid, WorkloadGridSkeleton };

/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";

import {
  formatActivityGroup,
  formatActivityTime,
  getActivityVerb,
  groupActivityEntries,
} from "@/src/lib/activity-display";
import type { ActivityEntry } from "@/src/server/activity/activity-management";

const getActivityContext = (entry: ActivityEntry): string | null => {
  if (
    entry.action !== "task.status_changed" ||
    !entry.details ||
    typeof entry.details !== "object" ||
    Array.isArray(entry.details)
  ) {
    return null;
  }
  const status = Object.entries(entry.details).find(
    ([key]) => key === "to"
  )?.[1];
  return typeof status === "string"
    ? `to ${status.replaceAll("_", " ")}`
    : null;
};

export const ProjectActivityFeed = ({
  entries,
  error,
}: {
  readonly entries: readonly ActivityEntry[];
  readonly error: boolean;
}) => {
  if (error) {
    return (
      <div className="panel panel-b" role="alert">
        Project activity could not be loaded.
      </div>
    );
  }

  if (!entries.length) {
    return (
      <section className="panel panel-b project-activity-empty">
        <h2>No activity yet</h2>
        <p className="muted">Changes to this project will appear here.</p>
      </section>
    );
  }

  return (
    <section aria-label="Project activity" className="project-activity-feed">
      {groupActivityEntries(entries).map(([group, groupEntries]) => (
        <section aria-labelledby={`project-activity-${group}`} key={group}>
          <h2 className="day-h" id={`project-activity-${group}`}>
            {formatActivityGroup(group)}
          </h2>
          <div className="feed lined">
            {groupEntries.map((entry) => {
              const activityHref = entry.projectId
                ? (`/projects/${entry.projectId}` as const)
                : undefined;
              let taskLink = null;
              if (entry.taskTitle && activityHref) {
                taskLink = (
                  <Link className="activity-link" href={activityHref}>
                    {entry.taskTitle}
                  </Link>
                );
              } else if (entry.taskTitle) {
                taskLink = <strong>{entry.taskTitle}</strong>;
              }
              const activityContext = getActivityContext(entry);

              return (
                <article className="fitem" key={entry.id}>
                  <span aria-hidden="true" className="av">
                    {entry.actorName.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="activity-copy grow">
                    <strong>{entry.actorName}</strong>{" "}
                    <span className="muted">
                      {getActivityVerb(entry.action)}
                    </span>{" "}
                    {taskLink}
                    {activityContext ? (
                      <>
                        {" "}
                        <span className="muted">{activityContext}</span>
                      </>
                    ) : null}
                    {!entry.taskTitle && entry.projectName && activityHref ? (
                      <Link className="activity-project" href={activityHref}>
                        {entry.projectName}
                      </Link>
                    ) : null}
                  </div>
                  <time
                    dateTime={entry.createdAt}
                    title={new Date(entry.createdAt).toLocaleString()}
                  >
                    {formatActivityTime(entry.createdAt)}
                  </time>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
};

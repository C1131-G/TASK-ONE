/* eslint-disable shadcn/no-unknown-classes */

import { connection } from "next/server";

import { listActivityAction } from "@/app/actions/activity";
import { listProjectsAction } from "@/app/actions/projects";

const ActivityFeed = async () => {
  await connection();
  const projects = await listProjectsAction({});
  if (!projects.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Activity could not be loaded.
      </div>
    );
  }

  const feeds = await Promise.all(
    projects.data.map(async (project) => ({
      name: project.name,
      result: await listActivityAction({ limit: 50, projectId: project.id }),
    }))
  );
  const entries = feeds.flatMap(({ name, result }) =>
    result.ok
      ? result.data.map((entry) => ({ ...entry, projectName: name }))
      : []
  );
  entries.sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return entries.length ? (
    <section className="panel">
      <div className="panel-h">
        <h2>Recent activity</h2>
      </div>
      <div className="panel-b feed lined">
        {entries.slice(0, 100).map((entry) => (
          <article className="row" key={entry.id}>
            <span aria-hidden="true" className="av">
              {entry.actorName.slice(0, 1).toUpperCase()}
            </span>
            <div className="grow">
              <p>
                <strong>{entry.actorName}</strong> {entry.action}
              </p>
              <p className="muted">{entry.projectName}</p>
            </div>
            <time className="faint" dateTime={entry.createdAt}>
              {entry.createdAt.slice(0, 16).replace("T", " ")}
            </time>
          </article>
        ))}
      </div>
    </section>
  ) : (
    <section className="panel panel-b">
      <h2>No activity yet</h2>
      <p className="muted">Changes to projects and tasks will appear here.</p>
    </section>
  );
};

const ActivityFeedSkeleton = () => (
  <section
    aria-busy="true"
    aria-labelledby="activity-loading-title"
    className="panel"
  >
    <div className="panel-h">
      <h2 id="activity-loading-title">Recent activity</h2>
    </div>
    <div className="panel-b">
      <output>Loading activity…</output>
    </div>
  </section>
);

export { ActivityFeed, ActivityFeedSkeleton };

/* eslint-disable shadcn/no-unknown-classes */

import type { Route } from "next";
import Link from "next/link";

import type { ActivityEntry } from "@/src/server/activity/activity-management";

const RecentActivityPanel = ({
  activities,
}: {
  readonly activities: readonly ActivityEntry[];
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Recent activity</h2>
      <Link className="btn btn-sm btn-ghost" href={"/activity" as Route}>
        View all
      </Link>
    </div>
    <div className="panel-b feed lined">
      {activities.length ? (
        activities.map((activity) => (
          <article className="mini" key={activity.id}>
            <span aria-hidden="true" className="av">
              {activity.actorName.slice(0, 1)}
            </span>
            <div className="grow">
              <strong>{activity.actorName}</strong>
              <p className="muted">{activity.action.replaceAll("_", " ")}</p>
            </div>
            <time className="muted" dateTime={activity.createdAt}>
              {activity.createdAt.slice(0, 10)}
            </time>
          </article>
        ))
      ) : (
        <p className="muted">No recent activity.</p>
      )}
    </div>
  </section>
);

export { RecentActivityPanel };

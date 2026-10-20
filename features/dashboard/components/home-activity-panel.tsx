/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";

import { LocalTime } from "@/components/workspace/local-time";
import type { ActivityEntry } from "@/src/server/activity/activity-management";

const RecentActivityPanel = ({
  activities,
}: {
  readonly activities: readonly ActivityEntry[];
}) => (
  <section className="panel">
    <div className="panel-h">
      <h2>Recent activity</h2>
      <Link className="btn btn-sm btn-ghost" href="/activity">
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
            <LocalTime
              className="muted"
              format="relative"
              value={activity.createdAt}
            />
          </article>
        ))
      ) : (
        <p className="muted">No recent activity.</p>
      )}
    </div>
  </section>
);

export { RecentActivityPanel };

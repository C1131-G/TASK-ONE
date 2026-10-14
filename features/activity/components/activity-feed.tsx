/* eslint-disable shadcn/no-unknown-classes */

import { listActivity } from "@/features/activity/activity-queries";
import { ActivityFeedList } from "@/features/activity/components/activity-feed-list";

const ActivityFeed = async () => {
  const result = await listActivity({ limit: 100 });
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Activity could not be loaded.
      </div>
    );
  }

  const entries = result.data;

  return entries.length ? (
    <ActivityFeedList entries={entries.slice(0, 100)} />
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

/* eslint-disable shadcn/no-unknown-classes */

import { CaretDown } from "@phosphor-icons/react/dist/ssr";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
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

const ACTIVITY_SKELETON_ROWS = SKELETON_KEYS.slice(0, 12);

// Mirrors ActivityFeedList: the filter row is static, only the entries are data.
const ActivityFeedSkeleton = () => (
  <section aria-label="Workspace activity" className="stack">
    <div className="row activity-filters" inert>
      <Tabs value="all">
        <div className="activity-tabs">
          <TabsList aria-label="Filter activity">
            <TabsTrigger aria-controls={undefined} value="all">
              All
            </TabsTrigger>
            <TabsTrigger aria-controls={undefined} value="status">
              Status changes
            </TabsTrigger>
            <TabsTrigger aria-controls={undefined} value="comments">
              Comments
            </TabsTrigger>
            <TabsTrigger aria-controls={undefined} value="projects">
              Projects
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
      <span className="skeleton-filter-select">
        Everyone
        <CaretDown aria-hidden="true" size={14} />
      </span>
    </div>
    <section className="panel">
      <div className="panel-h">
        <h2>Today</h2>
      </div>
      <SkelterSurface label="Loading activity…">
        <div className="panel-b feed lined">
          {ACTIVITY_SKELETON_ROWS.map((key) => (
            <article className="row activity-entry" key={key}>
              <SkeletonBone shape="avatar" />
              <p className="activity-copy grow">
                <SkeletonBone />
              </p>
              <SkeletonBone shape="short" />
            </article>
          ))}
        </div>
      </SkelterSurface>
    </section>
  </section>
);

export { ActivityFeed, ActivityFeedSkeleton };

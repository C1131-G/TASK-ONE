/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

import { Check, GearSix } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { listNotificationInbox } from "@/features/notifications/notifications-queries";

const NotificationFeed = async () => {
  const result = await listNotificationInbox({ limit: 100, unreadOnly: false });
  if (!result.ok) {
    throw new Error("Notifications could not be loaded.");
  }
  return (
    <NotificationList
      items={result.data.items}
      unreadCount={result.data.unreadCount}
    />
  );
};

const NOTIFICATION_ROWS = SKELETON_KEYS.slice(0, 5);

// Mirrors NotificationList: title, filters and the day heading are static;
// only the unread count and the rows are data.
const NotificationFeedSkeleton = () => (
  <section aria-label="Workspace notifications" className="notification-page">
    <header className="notification-page-heading">
      <div>
        <h1>Notifications</h1>
        <p>Updates on tasks and projects you follow.</p>
      </div>
      <div className="notification-page-actions" inert>
        <Tabs value="all">
          <TabsList aria-label="Filter notifications">
            <TabsTrigger aria-controls={undefined} value="all">
              All
            </TabsTrigger>
            <TabsTrigger aria-controls={undefined} value="unread">
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="btn btn-secondary">
          <Check aria-hidden="true" size={15} />
          Mark all as read
        </span>
        <Link className="btn btn-ghost" href="/settings?section=preferences">
          <GearSix aria-hidden="true" size={16} />
        </Link>
      </div>
    </header>
    <section aria-label="Today" className="notification-date-group">
      <h2>Today</h2>
      <SkelterSurface label="Loading notifications…">
        <div className="panel notification-card">
          {NOTIFICATION_ROWS.map((key) => (
            <article className="notification-row" key={key}>
              <span aria-hidden="true" className="notification-row-icon">
                <SkeletonBone shape="avatar" />
              </span>
              <div className="notification-row-copy">
                <p className="notification-row-title">
                  <SkeletonBone />
                </p>
                <p className="notification-row-snippet">
                  <SkeletonBone />
                </p>
                <p className="notification-row-meta">
                  <SkeletonBone shape="short" />
                </p>
              </div>
            </article>
          ))}
        </div>
      </SkelterSurface>
    </section>
  </section>
);

export { NotificationFeed, NotificationFeedSkeleton };

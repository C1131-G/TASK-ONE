/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { Bell } from "@phosphor-icons/react/dist/ssr";

import {
  SkeletonBone,
  SkeletonRows,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalNotificationList } from "@/features/portal/components/portal-notification-list";
import { getPortalCompany } from "@/features/portal/portal-company";
import { listPortalNotifications } from "@/features/portal/portal-queries";

const PortalNotifications = async () => {
  const [result, company] = await Promise.all([
    listPortalNotifications({}),
    getPortalCompany(),
  ]);
  if (!result.ok) {
    return (
      <div className="panel portal-alert" role="alert">
        Notifications could not be loaded. Refresh to try again.
      </div>
    );
  }
  const { items, unreadCount } = result.data;
  return (
    <>
      <div className="ph">
        <div>
          <h1>Notifications</h1>
          <p>
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "You are all caught up."}
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="panel empty-state">
          <span aria-hidden="true" className="glyph">
            <Bell size={22} />
          </span>
          <h2 className="es-h">No notifications yet</h2>
          <p>
            We will let you know here when the team replies or the status of one
            of your bugs changes.
          </p>
        </div>
      ) : (
        <PortalNotificationList
          isPreview={Boolean(company?.preview)}
          items={items}
          unreadCount={unreadCount}
        />
      )}
    </>
  );
};

const PortalNotificationsSkeleton = () => (
  <SkelterSurface label="Loading notifications">
    <div className="panel">
      <div className="panel-h portal-notif-bar">
        <SkeletonBone shape="title" />
        <SkeletonBone shape="control" />
      </div>
      <div className="panel-b">
        <SkeletonRows rows={5} />
      </div>
    </div>
  </SkelterSurface>
);

export { PortalNotifications, PortalNotificationsSkeleton };

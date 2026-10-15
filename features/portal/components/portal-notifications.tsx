/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { Bell } from "@phosphor-icons/react/dist/ssr";

import { PortalNotificationList } from "@/features/portal/components/portal-notification-list";
import { listPortalNotifications } from "@/features/portal/portal-queries";

const PortalNotifications = async () => {
  const result = await listPortalNotifications({});
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
        <PortalNotificationList items={items} unreadCount={unreadCount} />
      )}
    </>
  );
};

export { PortalNotifications };

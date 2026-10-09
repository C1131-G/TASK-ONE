import { Layer } from "effect";

import { Notifications } from "./contracts";
import {
  listInbox,
  markAllRead,
  markRead,
  setPreference,
} from "./inbox-operations";
import { sendDailyDueSummaries } from "./reminder-operations";

export { InboxSchema, Notifications } from "./contracts";
export type { InboxOptions, InboxPage, NotificationItem } from "./contracts";

export const NotificationsLive = Layer.succeed(
  Notifications,
  Notifications.of({
    listInbox,
    markAllRead,
    markRead,
    sendDailyDueSummaries,
    setPreference,
  })
);

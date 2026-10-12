import { Layer } from "effect";

import { Notifications } from "./contracts";
import {
  listInbox,
  listPreferences,
  markAllRead,
  markRead,
  setPreference,
} from "./inbox-operations";
import { sendDailyDueSummaries } from "./reminder-operations";

export {
  InboxSchema,
  NotificationPreferencesSchema,
  Notifications,
} from "./contracts";
export type {
  InboxOptions,
  InboxPage,
  NotificationItem,
  NotificationPreferenceValue,
} from "./contracts";

export const NotificationsLive = Layer.succeed(
  Notifications,
  Notifications.of({
    listInbox,
    listPreferences,
    markAllRead,
    markRead,
    sendDailyDueSummaries,
    setPreference,
  })
);

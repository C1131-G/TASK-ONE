import { isEmailEventType } from "@/src/server/email/email-events";
import type {
  NotificationChannel,
  NotificationPreferenceEvent,
  NotificationPreferenceValue,
} from "@/src/server/notifications/contracts";

const key = (
  channel: NotificationChannel,
  eventType: NotificationPreferenceEvent
): string => `${channel}:${eventType}`;

export const preferenceMap = (
  values: readonly NotificationPreferenceValue[]
): ReadonlyMap<string, boolean> =>
  new Map(
    values.map(({ channel, enabled, eventType }) => [
      key(channel, eventType),
      enabled,
    ])
  );

export const preferenceKey = key;

// In-app and push are on until switched off; email is off until switched on.
export const preferenceOn = (
  saved: ReadonlyMap<string, boolean>,
  channel: NotificationChannel,
  eventType: NotificationPreferenceEvent
): boolean => saved.get(key(channel, eventType)) ?? channel !== "email";

export const isChannelAvailable = (
  channel: NotificationChannel,
  eventType: NotificationPreferenceEvent
): boolean => channel !== "email" || isEmailEventType(eventType);

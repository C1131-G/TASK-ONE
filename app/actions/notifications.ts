"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  listNotificationInboxAction as listInbox,
  markNotificationReadAction as markRead,
  markAllNotificationsReadAction as markAllRead,
  setNotificationPreferenceAction as setPreference,
} from "./notifications-part-1";
import {
  registerPushSubscriptionAction as registerSubscription,
  removePushSubscriptionAction as removeSubscription,
} from "./notifications-part-2";

export async function listNotificationInboxAction(input: unknown) {
  return await listInbox(input);
}

export async function markNotificationReadAction(input: unknown) {
  return await markRead(input);
}

export async function markAllNotificationsReadAction(input: unknown) {
  return await markAllRead(input);
}

export async function setNotificationPreferenceAction(input: unknown) {
  return await setPreference(input);
}

export async function registerPushSubscriptionAction(input: unknown) {
  return await registerSubscription(input);
}

export async function removePushSubscriptionAction(input: unknown) {
  return await removeSubscription(input);
}

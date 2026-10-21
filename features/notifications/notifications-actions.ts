"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import { setEmailDigestAction as setEmailDigestImpl } from "./actions/notifications-email";
import {
  markAllNotificationsReadAction as markAllNotificationsReadImpl,
  markNotificationReadAction as markNotificationReadImpl,
  setNotificationPreferenceAction as setNotificationPreferenceImpl,
} from "./actions/notifications-inbox";
import {
  registerPushSubscriptionAction as registerPushSubscriptionImpl,
  removePushSubscriptionAction as removePushSubscriptionImpl,
} from "./actions/notifications-push-subscriptions";

export async function markNotificationReadAction(input: unknown) {
  return await markNotificationReadImpl(input);
}

export async function markAllNotificationsReadAction(input: unknown) {
  return await markAllNotificationsReadImpl(input);
}

export async function setNotificationPreferenceAction(input: unknown) {
  return await setNotificationPreferenceImpl(input);
}

export async function setEmailDigestAction(input: unknown) {
  return await setEmailDigestImpl(input);
}

export async function registerPushSubscriptionAction(input: unknown) {
  return await registerPushSubscriptionImpl(input);
}

export async function removePushSubscriptionAction(input: unknown) {
  return await removePushSubscriptionImpl(input);
}

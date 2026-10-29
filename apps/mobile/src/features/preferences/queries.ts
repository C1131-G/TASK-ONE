import { Effect } from "effect";

import type { NotificationPreferenceSchema } from "@api/routes-notifications";
import type { AppFailure } from "@/errors";
import type { MobileApi } from "@/services/mobile-api";

export type PreferenceAudience = "portal" | "workspace";
export type Preference = typeof NotificationPreferenceSchema.Type;

type Api = MobileApi["Service"];

/** A client can only receive replies and status changes. */
const portalEventOf = (event: Preference["eventType"]): "comment" | "status" | null =>
  event === "comment" || event === "status" ? event : null;

/** The kinds of notification the person switched on or off, per channel. */
export const getPreferences = (
  api: Api,
  audience: PreferenceAudience,
): Effect.Effect<readonly Preference[], AppFailure> =>
  audience === "workspace"
    ? Effect.map(
        api.call((client) => client.getWorkspaceNotificationPreferences()),
        (page) => page.preferences,
      )
    : Effect.map(
        api.call((client) => client.getPortalNotificationPreferences()),
        (page) => page.preferences,
      );

/** Switches one kind on or off for one channel, under an idempotency key. */
export const setPreference = (
  api: Api,
  key: string,
  audience: PreferenceAudience,
  preference: Preference,
): Effect.Effect<{ readonly done: true }, AppFailure> => {
  if (audience === "workspace") {
    return api.call((client) =>
      client.setWorkspaceNotificationPreference({ body: preference, idempotencyKey: key }),
    );
  }
  const eventType = portalEventOf(preference.eventType);
  // The portal list only ever holds those two kinds, so nothing else is sent.
  return eventType === null
    ? Effect.succeed({ done: true as const })
    : api.call((client) =>
        client.setPortalNotificationPreference({
          body: { channel: preference.channel, enabled: preference.enabled, eventType },
          idempotencyKey: key,
        }),
      );
};

export const EVENT_LABELS: Record<Preference["eventType"], string> = {
  assignment: "Assigned to me",
  comment: "Comments and replies",
  due: "Due dates",
  mention: "Mentions",
  status: "Status changes",
  update: "Updates",
};

export const CHANNEL_LABELS: Record<Preference["channel"], string> = {
  email: "Email",
  "in-app": "In the app",
  "web-push": "Push",
};

/** Groups the flat list by kind, keeping the order the server gave. */
export const groupByEvent = (
  preferences: readonly Preference[],
): readonly { readonly eventType: Preference["eventType"]; readonly rows: readonly Preference[] }[] => {
  const groups = new Map<Preference["eventType"], Preference[]>();
  for (const preference of preferences) {
    const rows = groups.get(preference.eventType) ?? [];
    rows.push(preference);
    groups.set(preference.eventType, rows);
  }
  return [...groups].map(([eventType, rows]) => ({ eventType, rows }));
};

/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useOptimistic } from "react";

import { Switch } from "@/components/ui/switch";
import { setNotificationPreferenceAction } from "@/features/notifications/notifications-actions";
import { useSaveState } from "@/features/settings/hooks/use-settings-save";
import type { NotificationPreferenceValue } from "@/src/server/notifications/contracts";

const NOTIFICATION_EVENTS = [
  { id: "mention", label: "Mentions" },
  { id: "assignment", label: "Assignments" },
  { id: "comment", label: "Comments" },
  { id: "update", label: "Task and project updates" },
  { id: "due", label: "Due and overdue reminders" },
] as const;
const NOTIFICATION_CHANNELS = [
  { id: "in-app", label: "In app" },
  { id: "web-push", label: "Browser push" },
] as const;
type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]["id"];
type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]["id"];

const NotificationPreferencesForm = ({
  values,
}: {
  readonly values: readonly NotificationPreferenceValue[];
}) => {
  const { error, pending, setError, startTransition } = useSaveState();
  const saved = new Map<string, boolean>();
  for (const { channel, enabled: isEnabled, eventType } of values) {
    saved.set(`${channel}:${eventType}`, isEnabled);
  }
  // The switch flips at once; the saved values come back with the action's
  // revalidation, and a failed save falls back to them.
  const [enabled, setOptimisticPreference] = useOptimistic(
    saved,
    (current, change: { readonly key: string; readonly value: boolean }) =>
      new Map(current).set(change.key, change.value)
  );

  const updatePreference = (
    channel: NotificationChannel,
    eventType: NotificationEvent,
    nextEnabled: boolean
  ) => {
    startTransition(async () => {
      setOptimisticPreference({
        key: `${channel}:${eventType}`,
        value: nextEnabled,
      });
      try {
        const result = await setNotificationPreferenceAction({
          channel,
          enabled: nextEnabled,
          eventType,
          idempotencyKey: crypto.randomUUID(),
        });
        setError(result.ok ? null : result.error.message);
      } catch {
        setError("Your preference could not be saved. Try again.");
      }
    });
  };

  return (
    <section aria-labelledby="notification-preferences-title" className="panel">
      <div className="panel-h">
        <h2 id="notification-preferences-title">Notification preferences</h2>
        <p>Choose which workspace updates reach you and where.</p>
      </div>
      <div className="panel-b notification-preferences-grid">
        <div aria-hidden="true" className="notification-preferences-header">
          <span>Update</span>
          {NOTIFICATION_CHANNELS.map(({ id, label }) => (
            <span key={id}>{label}</span>
          ))}
        </div>
        {NOTIFICATION_EVENTS.map(({ id, label }) => (
          <div className="notification-preference-row" key={id}>
            <strong>{label}</strong>
            {NOTIFICATION_CHANNELS.map(
              ({ id: channel, label: channelLabel }) => {
                const controlId = `notification-${channel}-${id}`;
                const preferenceKey = `${channel}:${id}`;
                return (
                  <label
                    className="notification-preference-control"
                    htmlFor={controlId}
                    key={channel}
                  >
                    <span className="sr-only">
                      {label} notifications {channelLabel.toLowerCase()}
                    </span>
                    <Switch
                      checked={enabled.get(preferenceKey) ?? true}
                      disabled={pending}
                      id={controlId}
                      onCheckedChange={(checked) =>
                        updatePreference(channel, id, checked)
                      }
                    />
                  </label>
                );
              }
            )}
          </div>
        ))}
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
};

export { NotificationPreferencesForm };

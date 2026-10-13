/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState } from "react";

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
  const { error, pending, router, setError, startTransition } = useSaveState();
  const [enabled, setEnabled] = useState(() => {
    const preferences = new Map<string, boolean>();
    for (const { channel, enabled: isEnabled, eventType } of values) {
      preferences.set(`${channel}:${eventType}`, isEnabled);
    }
    return preferences;
  });

  const updatePreference = (
    channel: NotificationChannel,
    eventType: NotificationEvent,
    nextEnabled: boolean
  ) => {
    const key = `${channel}:${eventType}`;
    const previousEnabled = enabled.get(key) ?? true;
    setEnabled((current) => new Map(current).set(key, nextEnabled));
    startTransition(async () => {
      const result = await setNotificationPreferenceAction({
        channel,
        enabled: nextEnabled,
        eventType,
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setEnabled((current) => new Map(current).set(key, previousEnabled));
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
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

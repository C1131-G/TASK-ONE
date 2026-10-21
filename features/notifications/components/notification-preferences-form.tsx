/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useOptimistic } from "react";

import { Switch } from "@/components/ui/switch";
import {
  isChannelAvailable,
  preferenceKey,
  preferenceMap,
  preferenceOn,
} from "@/features/notifications/notification-preference-state";
import {
  setEmailDigestAction,
  setNotificationPreferenceAction,
} from "@/features/notifications/notifications-actions";
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
  { id: "email", label: "Email" },
] as const;
type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]["id"];
type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number]["id"];

const NotificationPreferencesForm = ({
  emailDigest,
  values,
}: {
  readonly emailDigest: boolean;
  readonly values: readonly NotificationPreferenceValue[];
}) => {
  const {
    error,
    pending,
    saved: notifyPreferenceSaved,
    setError,
    startTransition,
  } = useSaveState();
  const saved = preferenceMap(values);
  // The switch flips at once; the saved values come back with the action's
  // revalidation, and a failed save falls back to them.
  const [enabled, setOptimisticPreference] = useOptimistic(
    saved,
    (current, change: { readonly key: string; readonly value: boolean }) =>
      new Map(current).set(change.key, change.value)
  );

  const [digestOn, setOptimisticDigest] = useOptimistic(
    emailDigest,
    (_current, next: boolean) => next
  );

  const updateDigest = (nextDigest: boolean) => {
    startTransition(async () => {
      setOptimisticDigest(nextDigest);
      try {
        const result = await setEmailDigestAction({
          digest: nextDigest,
          idempotencyKey: crypto.randomUUID(),
        });
        if (result.ok) {
          notifyPreferenceSaved("Email delivery saved");
        } else {
          setError(result.error.message);
        }
      } catch {
        setError("Your preference could not be saved. Try again.");
      }
    });
  };

  const updatePreference = (
    channel: NotificationChannel,
    eventType: NotificationEvent,
    nextEnabled: boolean
  ) => {
    startTransition(async () => {
      setOptimisticPreference({
        key: preferenceKey(channel, eventType),
        value: nextEnabled,
      });
      try {
        const result = await setNotificationPreferenceAction({
          channel,
          enabled: nextEnabled,
          eventType,
          idempotencyKey: crypto.randomUUID(),
        });
        if (result.ok) {
          notifyPreferenceSaved("Notification preference saved");
        } else {
          setError(result.error.message);
        }
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
                if (!isChannelAvailable(channel, id)) {
                  return (
                    <span
                      aria-hidden="true"
                      className="notification-preference-control"
                      key={channel}
                    >
                      –
                    </span>
                  );
                }
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
                      checked={preferenceOn(enabled, channel, id)}
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
        <label
          className="notification-email-digest"
          htmlFor="notification-email-digest"
        >
          <span>
            <strong>Daily email digest</strong>
            <small>
              Send the email updates you chose as one message each morning
              instead of one by one.
            </small>
          </span>
          <Switch
            checked={digestOn}
            disabled={pending}
            id="notification-email-digest"
            onCheckedChange={updateDigest}
          />
        </label>
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

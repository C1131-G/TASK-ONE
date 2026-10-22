/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in app/workspace-styles. */

"use client";

import {
  WEBHOOK_EVENT_LABELS,
  WEBHOOK_EVENT_TYPES,
} from "@/src/server/webhooks/webhook-events";

// A comment or task completion is reported once, as its own event type, so a
// subscriber never receives two messages for one change.
export const WebhookEventFields = ({
  checked,
  legend = "Events",
}: {
  readonly checked: readonly string[];
  readonly legend?: string;
}) => (
  <fieldset className="field">
    <legend>{legend}</legend>
    <div className="stack">
      {WEBHOOK_EVENT_TYPES.map((event) => (
        <label className="row" key={event}>
          <input
            defaultChecked={checked.includes(event)}
            name="events"
            type="checkbox"
            value={event}
          />
          <span>{WEBHOOK_EVENT_LABELS[event]}</span>
        </label>
      ))}
    </div>
  </fieldset>
);

/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { calendarFeedUrl } from "@/features/settings/calendar-feed-url";
import {
  revokeCalendarFeedAction,
  rotateCalendarFeedAction,
} from "@/features/settings/settings-actions";

interface FeedStatus {
  readonly active: boolean;
  readonly createdAt: string | null;
  readonly lastUsedAt: string | null;
}

const formatStamp = (value: string | null): string | null =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

export const CalendarFeedCard = ({
  status,
}: {
  readonly status: FeedStatus;
}) => {
  const [pending, startTransition] = useTransition();
  // The secret exists in the browser only until the page is left.
  const [url, setUrl] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const rotate = () =>
    startTransition(async () => {
      setFailure(null);
      setCopied(false);
      const result = await rotateCalendarFeedAction({});
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      setUrl(calendarFeedUrl(window.location.origin, result.data.token));
    });

  const revoke = () =>
    startTransition(async () => {
      setFailure(null);
      const result = await revokeCalendarFeedAction({});
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      setUrl(null);
    });

  const copy = async () => {
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setFailure("Copy failed. Select the link and copy it by hand.");
    }
  };

  const active = status.active || url !== null;
  const lastUsed = formatStamp(status.lastUsedAt);

  return (
    <section className="panel" data-calendar-feed="true">
      <div className="panel-h">
        <h2>Calendar feed</h2>
        <p>
          Subscribe to your tasks with due dates and calendar events from Google
          Calendar, Outlook or Apple Calendar.
        </p>
      </div>
      <div className="panel-b stack">
        {url ? (
          <div className="field">
            <label htmlFor="calendar-feed-url">Your private feed link</label>
            <input
              className="input"
              id="calendar-feed-url"
              onFocus={(event) => event.currentTarget.select()}
              readOnly
              value={url}
            />
            <p className="muted">
              Copy it now. For your security this link is shown only once;
              generate a new one if you lose it. Anyone with the link can see
              your tasks, so keep it private.
            </p>
            <div className="row">
              <WorkspaceButton
                className="btn btn-secondary btn-sm"
                onClick={copy}
                type="button"
              >
                {copied ? "Copied" : "Copy link"}
              </WorkspaceButton>
            </div>
          </div>
        ) : (
          <p className="muted">
            {active
              ? `A feed link is active${lastUsed ? `; it was last used ${lastUsed}` : " and has not been used yet"}. The link itself is not stored, so it cannot be shown again.`
              : "You have no feed link yet."}
          </p>
        )}
        {failure ? <p role="alert">{failure}</p> : null}
        <div className="row">
          {active ? (
            <WorkspaceConfirmDialog
              confirmLabel="Generate new link"
              description="The current link stops working right away. Update any calendar app that uses it."
              onConfirm={rotate}
              title="Generate a new feed link?"
            >
              <WorkspaceButton
                className="btn btn-secondary btn-sm"
                disabled={pending}
                type="button"
              >
                Generate new link
              </WorkspaceButton>
            </WorkspaceConfirmDialog>
          ) : (
            <WorkspaceButton
              aria-busy={pending || undefined}
              className="btn btn-primary btn-sm"
              disabled={pending}
              onClick={rotate}
              type="button"
            >
              {pending ? "Creating…" : "Create feed link"}
            </WorkspaceButton>
          )}
          {active ? (
            <WorkspaceConfirmDialog
              confirmLabel="Revoke link"
              description="Calendar apps using this link will stop receiving updates. You can create a new link at any time."
              onConfirm={revoke}
              title="Revoke the feed link?"
            >
              <WorkspaceButton
                className="btn btn-danger-ghost btn-sm"
                disabled={pending}
                type="button"
              >
                Revoke link
              </WorkspaceButton>
            </WorkspaceConfirmDialog>
          ) : null}
        </div>
      </div>
    </section>
  );
};

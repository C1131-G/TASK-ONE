"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import Link from "next/link";
import { useState } from "react";

import { PortalTime } from "@/features/portal/components/portal-time";
import {
  markAllPortalNotificationsReadAction,
  markPortalNotificationReadAction,
} from "@/features/portal/portal-actions";
import type { PortalNotificationList as PortalNotificationData } from "@/src/server/portal/portal-contracts";

type Item = PortalNotificationData["items"][number];

const PortalNotificationList = ({
  isPreview = false,
  items,
  unreadCount,
}: {
  readonly isPreview?: boolean;
  readonly items: readonly Item[];
  readonly unreadCount: number;
}) => {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(new Set());

  const markOne = async (id: string) => {
    if (isPreview) {
      return;
    }
    setError("");
    try {
      const result = await markPortalNotificationReadAction({
        notificationId: id,
      });
      if (result.ok) {
        setReadIds((current) => new Set([...current, id]));
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("The notification could not be marked as read.");
    }
  };

  const markAll = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await markAllPortalNotificationsReadAction({});
      if (result.ok) {
        setReadIds(new Set(items.map(({ id }) => id)));
      } else {
        setError(result.error.message);
      }
    } catch {
      setError("Notifications could not be marked as read.");
    }
    setBusy(false);
  };

  const isUnread = (item: Item) =>
    item.readAt === null && !readIds.has(item.id);
  const remaining = items.filter(isUnread).length;

  return (
    <section aria-label="Notifications" className="panel">
      <div className="panel-h portal-notif-bar">
        <h2>
          {remaining > 0 ? `${remaining || unreadCount} unread` : "All read"}
        </h2>
        <div className="acts">
          <button
            className="btn btn-secondary btn-sm"
            disabled={isPreview || busy || remaining === 0}
            onClick={markAll}
            title={isPreview ? "Disabled in preview" : undefined}
            type="button"
          >
            {busy ? "Marking…" : "Mark all as read"}
          </button>
        </div>
      </div>
      {error ? (
        <p className="portal-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="portal-notifs">
        {items.map((item) => {
          const unread = isUnread(item);
          const body = (
            <>
              <span className="portal-notif-text">
                {unread ? (
                  <>
                    <span aria-hidden="true" className="portal-dot" />
                    <span className="sr-only">Unread: </span>
                  </>
                ) : null}
                <strong>{item.text}</strong>
              </span>
              {item.snippet ? (
                <span className="portal-notif-snippet">{item.snippet}</span>
              ) : null}
              <span className="faint">
                <PortalTime iso={item.createdAt} />
              </span>
            </>
          );
          return (
            <li
              className="portal-notif"
              data-unread={unread || undefined}
              key={item.id}
            >
              {item.bugId ? (
                <Link
                  className="portal-notif-main"
                  href={`/portal/bugs/${item.bugId}`}
                  transitionTypes={["nav-forward"]}
                  onClick={() => {
                    if (unread) {
                      void markOne(item.id);
                    }
                  }}
                >
                  {body}
                </Link>
              ) : (
                <div className="portal-notif-main">{body}</div>
              )}
              {unread && !isPreview ? (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => markOne(item.id)}
                  type="button"
                >
                  Mark read
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export { PortalNotificationList };

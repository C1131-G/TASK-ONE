/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { NotificationItem } from "@/src/server/notifications/contracts";

const NotificationList = ({
  items,
  unreadCount,
}: {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const markAllRead = () =>
    startTransition(async () => {
      const result = await markAllNotificationsReadAction({
        idempotencyKey: crypto.randomUUID(),
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const markRead = (notificationId: string) =>
    startTransition(async () => {
      const result = await markNotificationReadAction({
        idempotencyKey: crypto.randomUUID(),
        notificationId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>Notifications</h2>
        {unreadCount > 0 ? (
          <WorkspaceButton
            className="btn btn-sm btn-secondary"
            disabled={pending}
            onClick={markAllRead}
            type="button"
          >
            Mark all read
          </WorkspaceButton>
        ) : null}
      </div>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {items.length ? (
        <div className="panel-b feed lined">
          {items.map((item) => (
            <article className="feed-item" key={item.id}>
              <div className="row">
                <span
                  aria-hidden="true"
                  className={`ndot${item.readAt ? " read" : ""}`}
                />
                <div className="grow">
                  <p>{item.text}</p>
                  {item.snippet ? (
                    <p className="muted">{item.snippet}</p>
                  ) : null}
                  <time className="faint" dateTime={item.createdAt}>
                    {item.createdAt.slice(0, 16).replace("T", " ")}
                  </time>
                </div>
                {item.readAt ? null : (
                  <WorkspaceButton
                    aria-label={`Mark as read: ${item.text}`}
                    className="btn btn-sm btn-ghost"
                    disabled={pending}
                    onClick={() => markRead(item.id)}
                    type="button"
                  >
                    Mark read
                  </WorkspaceButton>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="panel-b muted">You’re all caught up.</div>
      )}
    </section>
  );
};

export { NotificationList };

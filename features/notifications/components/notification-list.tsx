/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { Bell, Check, GearSix } from "@phosphor-icons/react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  DATE_BUCKETS,
  DATE_FORMATTER,
  formatRelativeTime,
  getDateBucket,
  getNotificationIcon,
} from "@/features/notifications/notification-list-format";
import type {
  DateBucket,
  NotificationFilter,
} from "@/features/notifications/notification-list-format";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/notifications-actions";
import { useSearchParamState } from "@/hooks/use-search-param-state";
import type { NotificationItem } from "@/src/server/notifications/contracts";

const NOTIFICATION_FILTERS: readonly NotificationFilter[] = ["all", "unread"];

const NotificationList = ({
  items,
  unreadCount,
}: {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
}) => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useSearchParamState<NotificationFilter>(
    "show",
    NOTIFICATION_FILTERS,
    "all"
  );
  const visibleItems = items.filter(
    (notification) => filter === "all" || notification.readAt === null
  );
  const groupedItems = new Map<DateBucket, NotificationItem[]>(
    DATE_BUCKETS.map((bucket) => [bucket, []])
  );
  for (const notification of visibleItems) {
    groupedItems.get(getDateBucket(notification.createdAt))?.push(notification);
  }

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
    });

  return (
    <section aria-label="Workspace notifications" className="notification-page">
      <header className="notification-page-heading">
        <div>
          <h1>
            Notifications
            {unreadCount > 0 ? (
              <span className="notification-unread-count">
                {unreadCount} unread
              </span>
            ) : null}
          </h1>
          <p>Updates on tasks and projects you follow.</p>
        </div>
        <div className="notification-page-actions">
          <Tabs
            onValueChange={(value) => {
              if (value === "all" || value === "unread") {
                setFilter(value);
              }
            }}
            value={filter}
          >
            <TabsList aria-label="Filter notifications">
              <TabsTrigger aria-controls={undefined} value="all">
                All
              </TabsTrigger>
              <TabsTrigger aria-controls={undefined} value="unread">
                Unread
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <WorkspaceButton
            className="btn btn-secondary"
            disabled={pending || unreadCount === 0}
            onClick={markAllRead}
            type="button"
          >
            <Check aria-hidden="true" size={15} />
            Mark all as read
          </WorkspaceButton>
          <WorkspaceButton
            asChild
            aria-label="Notification preferences"
            type="button"
            variant="ghost"
          >
            <Link href="/settings?section=preferences" prefetch={false}>
              <GearSix aria-hidden="true" size={16} />
              <span className="sr-only">Notification preferences</span>
            </Link>
          </WorkspaceButton>
        </div>
      </header>
      {error ? (
        <p className="panel-b error" role="alert">
          {error}
        </p>
      ) : null}
      {visibleItems.length ? (
        DATE_BUCKETS.map((bucket) => {
          const bucketItems = groupedItems.get(bucket) ?? [];
          if (bucketItems.length === 0) {
            return null;
          }
          return (
            <section
              aria-label={bucket}
              className="notification-date-group"
              key={bucket}
            >
              <h2>{bucket}</h2>
              <div className="panel notification-card">
                {bucketItems.map((notification) => {
                  const Icon = getNotificationIcon(notification.type);
                  return (
                    <article
                      className={`notification-row${notification.readAt === null ? " unread" : ""}`}
                      key={notification.id}
                    >
                      <span
                        aria-hidden="true"
                        className="notification-row-icon"
                      >
                        <Icon size={17} />
                      </span>
                      <div className="notification-row-copy">
                        <p className="notification-row-title">
                          {notification.projectId ? (
                            <Link
                              href={`/projects/${notification.projectId}?view=board`}
                            >
                              {notification.text}
                            </Link>
                          ) : (
                            notification.text
                          )}
                        </p>
                        {notification.snippet ? (
                          <p className="notification-row-snippet">
                            {notification.snippet}
                          </p>
                        ) : null}
                        <p className="notification-row-meta">
                          {notification.projectName ? (
                            <span>{notification.projectName}</span>
                          ) : null}
                          {notification.projectName ? (
                            <span aria-hidden="true">·</span>
                          ) : null}
                          <time
                            dateTime={notification.createdAt}
                            title={DATE_FORMATTER.format(
                              new Date(notification.createdAt)
                            )}
                          >
                            {formatRelativeTime(notification.createdAt)}
                          </time>
                        </p>
                      </div>
                      {notification.readAt === null ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="notification-unread-dot"
                          />
                          <span className="sr-only">Unread</span>
                          <WorkspaceButton
                            aria-label={`Mark as read: ${notification.text}`}
                            className="btn btn-sm btn-ghost notification-row-read"
                            disabled={pending}
                            onClick={() => markRead(notification.id)}
                            type="button"
                          >
                            <Check aria-hidden="true" size={15} />
                          </WorkspaceButton>
                        </>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      ) : (
        <div className="panel notification-empty">
          <Bell aria-hidden="true" size={22} />
          <p>
            {filter === "unread"
              ? "You’re all caught up."
              : "No notifications yet."}
          </p>
          {filter === "unread" ? (
            <WorkspaceButton
              onClick={() => setFilter("all")}
              type="button"
              variant="secondary"
            >
              Show all
            </WorkspaceButton>
          ) : null}
        </div>
      )}
    </section>
  );
};

export { NotificationList };

/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import {
  Bell,
  ChatCircle,
  Check,
  GearSix,
  UserPlus,
} from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import type { NotificationItem } from "@/src/server/notifications/contracts";

type NotificationFilter = "all" | "unread";
type DateBucket = "Today" | "Yesterday" | "This week" | "Earlier";

const DATE_BUCKETS: readonly DateBucket[] = [
  "Today",
  "Yesterday",
  "This week",
  "Earlier",
];
const DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});
const DATE_ONLY_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
});

const getDateBucket = (value: string): DateBucket => {
  const today = new Date();
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  const date = new Date(value);
  const valueUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  );
  const daysAgo = Math.floor((todayUtc - valueUtc) / 86_400_000);
  if (daysAgo === 0) {
    return "Today";
  }
  if (daysAgo === 1) {
    return "Yesterday";
  }
  return daysAgo < 7 ? "This week" : "Earlier";
};

const formatRelativeTime = (value: string): string => {
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 60) {
    return `${Math.max(1, minutes)}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return days < 7
    ? `${days}d ago`
    : DATE_ONLY_FORMATTER.format(new Date(value));
};

const getNotificationIcon = (type: string) => {
  if (type === "mention" || type === "comment") {
    return ChatCircle;
  }
  if (type === "assignment") {
    return UserPlus;
  }
  return Bell;
};

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
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const visibleItems = items.filter(
    (item) => filter === "all" || item.readAt === null
  );
  const groupedItems = new Map<DateBucket, NotificationItem[]>(
    DATE_BUCKETS.map((bucket) => [bucket, []])
  );
  for (const item of visibleItems) {
    groupedItems.get(getDateBucket(item.createdAt))?.push(item);
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
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unread">Unread</TabsTrigger>
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
                {bucketItems.map((item) => {
                  const Icon = getNotificationIcon(item.type);
                  return (
                    <article
                      className={`notification-row${item.readAt === null ? " unread" : ""}`}
                      key={item.id}
                    >
                      <span
                        aria-hidden="true"
                        className="notification-row-icon"
                      >
                        <Icon size={17} />
                      </span>
                      <div className="notification-row-copy">
                        <p className="notification-row-title">
                          {item.projectId ? (
                            <Link
                              href={
                                `/projects/${item.projectId}?view=board` as Route
                              }
                            >
                              {item.text}
                            </Link>
                          ) : (
                            item.text
                          )}
                        </p>
                        {item.snippet ? (
                          <p className="notification-row-snippet">
                            {item.snippet}
                          </p>
                        ) : null}
                        <p className="notification-row-meta">
                          {item.projectName ? (
                            <span>{item.projectName}</span>
                          ) : null}
                          {item.projectName ? (
                            <span aria-hidden="true">·</span>
                          ) : null}
                          <time
                            dateTime={item.createdAt}
                            title={DATE_FORMATTER.format(
                              new Date(item.createdAt)
                            )}
                          >
                            {formatRelativeTime(item.createdAt)}
                          </time>
                        </p>
                      </div>
                      {item.readAt === null ? (
                        <>
                          <span
                            aria-label="Unread"
                            className="notification-unread-dot"
                          />
                          <WorkspaceButton
                            aria-label={`Mark as read: ${item.text}`}
                            className="btn btn-sm btn-ghost notification-row-read"
                            disabled={pending}
                            onClick={() => markRead(item.id)}
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

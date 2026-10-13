/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { Bell, Check, EnvelopeOpen } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { InboxDetailContent } from "@/features/notifications/components/inbox-detail-content";
import {
  DATE_FORMATTER,
  FILTERS,
  formatRelativeTime,
  getInitials,
  typeMatchesFilter,
} from "@/features/notifications/inbox-format";
import type { InboxFilter } from "@/features/notifications/inbox-format";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/features/notifications/notifications-actions";
import type { NotificationItem } from "@/src/server/notifications/contracts";

export const InboxWorkspace = ({
  items,
  unreadCount,
}: {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
}) => {
  const router = useRouter();
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    items[0]?.id ?? null
  );
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const visibleItems = useMemo(
    () =>
      items.filter(
        (item) =>
          typeMatchesFilter(item.type, filter) &&
          (!unreadOnly || item.readAt === null)
      ),
    [filter, items, unreadOnly]
  );
  const selectedItem = visibleItems.find(({ id }) => id === selectedId) ?? null;
  const counts = useMemo(
    () =>
      new Map(
        FILTERS.map(({ id }) => [
          id,
          items.filter((item) => typeMatchesFilter(item.type, id)).length,
        ])
      ),
    [items]
  );

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

  const selectNotification = (notificationId: string) => {
    setSelectedId(notificationId);
    if (window.matchMedia("(max-width: 900px)").matches) {
      setMobileDetailOpen(true);
    }
  };

  return (
    <section aria-label="Inbox notifications" className="inbox-workspace">
      <div className="panel inbox-list-panel">
        <div className="inbox-filters">
          <div className="row inbox-filter-actions">
            <label
              className="row inbox-unread-toggle"
              htmlFor="inbox-unread-only"
            >
              <Checkbox
                checked={unreadOnly}
                id="inbox-unread-only"
                onCheckedChange={(checked) => setUnreadOnly(checked === true)}
              />
              Unread
            </label>
            {unreadCount > 0 ? (
              <WorkspaceButton
                aria-label="Mark all as read"
                className="inbox-mark-all"
                disabled={pending}
                onClick={markAllRead}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Check aria-hidden="true" />
                <span className="sr-only">Mark all as read</span>
              </WorkspaceButton>
            ) : null}
          </div>
          <Tabs
            onValueChange={(value) => {
              const nextFilter = FILTERS.find(
                ({ id: filterId }) => filterId === value
              );
              if (nextFilter) {
                setFilter(nextFilter.id);
              }
            }}
            value={filter}
          >
            <TabsList aria-label="Filter inbox by type" className="inbox-tabs">
              {FILTERS.map(({ id, label }) => (
                <TabsTrigger aria-controls={undefined} key={id} value={id}>
                  {label} <span>{counts.get(id) ?? 0}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        {error ? (
          <p className="panel-b error" role="alert">
            {error}
          </p>
        ) : null}
        {visibleItems.length > 0 ? (
          <ul aria-label="Notifications" className="inbox-items">
            {visibleItems.map((item) => {
              const isSelected = selectedItem?.id === item.id;
              return (
                <li
                  className={`inbox-item${item.readAt ? " read" : " unread"}${isSelected ? " selected" : ""}`}
                  key={item.id}
                >
                  <WorkspaceButton
                    aria-pressed={isSelected}
                    data-inbox-item-select=""
                    onClick={() => selectNotification(item.id)}
                    size="lg"
                    type="button"
                    variant="ghost"
                    workspace
                  >
                    <span aria-hidden="true" className="ndot" />
                    {item.actorName ? (
                      <Avatar className="inbox-avatar">
                        <AvatarFallback>
                          {getInitials(item.actorName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span aria-hidden="true" className="inbox-system-icon">
                        <Bell />
                      </span>
                    )}
                    <span className="inbox-item-copy">
                      <span className="inbox-item-title">{item.text}</span>
                      {item.snippet ? (
                        <span className="inbox-item-snippet">
                          {item.snippet}
                        </span>
                      ) : null}
                      <span className="inbox-item-meta">
                        {item.projectName ? (
                          <span className="inbox-item-project">
                            {item.projectName}
                          </span>
                        ) : null}
                        <time
                          className="inbox-item-time"
                          dateTime={item.createdAt}
                          title={DATE_FORMATTER.format(
                            new Date(item.createdAt)
                          )}
                        >
                          {formatRelativeTime(item.createdAt)}
                        </time>
                      </span>
                    </span>
                  </WorkspaceButton>
                  {item.readAt === null ? (
                    <WorkspaceButton
                      aria-label={`Mark as read: ${item.text}`}
                      className="inbox-item-read"
                      disabled={pending}
                      onClick={() => markRead(item.id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <EnvelopeOpen aria-hidden="true" />
                    </WorkspaceButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="panel-b muted inbox-empty">
            No notifications match this filter.
          </div>
        )}
      </div>
      <aside aria-label="Selected notification" className="panel inbox-detail">
        <div className="panel-h">
          <h2>Notification details</h2>
        </div>
        <div className="panel-b">
          <InboxDetailContent
            item={selectedItem}
            onMarkRead={markRead}
            pending={pending}
          />
        </div>
      </aside>
      <Sheet onOpenChange={setMobileDetailOpen} open={mobileDetailOpen}>
        <SheetContent
          className="workspace-app inbox-mobile-detail-sheet"
          data-workspace-sheet=""
          side="bottom"
          showCloseButton
        >
          <SheetHeader className="inbox-mobile-detail-header">
            <SheetTitle>Notification details</SheetTitle>
            <SheetDescription>
              Review the update and open its project.
            </SheetDescription>
          </SheetHeader>
          <InboxDetailContent
            item={selectedItem}
            onMarkRead={markRead}
            pending={pending}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
};

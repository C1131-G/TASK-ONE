/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { Bell, Check, EnvelopeOpen, Tray } from "@phosphor-icons/react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

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
import { EmptyState } from "@/components/workspace/empty-state";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { InboxDetailContent } from "@/features/notifications/components/inbox-detail-content";
import { useInboxReadState } from "@/features/notifications/hooks/use-inbox-read-state";
import {
  DATE_FORMATTER,
  FILTERS,
  formatRelativeTime,
  getInitials,
  typeMatchesFilter,
} from "@/features/notifications/inbox-format";
import type { NotificationItem } from "@/src/server/notifications/contracts";

const updateUrl = (key: string, value: string | null) => {
  const url = new URL(window.location.href);
  if (value) {
    url.searchParams.set(key, value);
  } else {
    url.searchParams.delete(key);
  }
  window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
};

export const InboxWorkspace = ({
  items,
  unreadCount,
}: {
  readonly items: readonly NotificationItem[];
  readonly unreadCount: number;
}) => {
  const searchParams = useSearchParams();
  const filterValue = searchParams.get("type");
  const filter = FILTERS.find(({ id }) => id === filterValue)?.id ?? "all";
  const unreadOnly = searchParams.get("unread") === "1";
  const selectedId = searchParams.get("notification") ?? items[0]?.id ?? null;
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const { error, markAllRead, markRead, pending, shownItems, shownUnread } =
    useInboxReadState(items, unreadCount);
  const visibleItems = useMemo(
    () =>
      shownItems.filter(
        (notification) =>
          typeMatchesFilter(notification.type, filter) &&
          (!unreadOnly || notification.readAt === null)
      ),
    [filter, shownItems, unreadOnly]
  );
  const selectedItem = visibleItems.find(({ id }) => id === selectedId) ?? null;
  const counts = useMemo(
    () =>
      new Map(
        FILTERS.map(({ id }) => [
          id,
          items.filter((notification) =>
            typeMatchesFilter(notification.type, id)
          ).length,
        ])
      ),
    [items]
  );

  const selectNotification = (notificationId: string) => {
    updateUrl("notification", notificationId);
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
                onCheckedChange={(checked) =>
                  updateUrl("unread", checked === true ? "1" : null)
                }
              />
              Unread
            </label>
            {shownUnread > 0 ? (
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
                updateUrl(
                  "type",
                  nextFilter.id === "all" ? null : nextFilter.id
                );
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
            {visibleItems.map((notification) => {
              const isSelected = selectedItem?.id === notification.id;
              return (
                <li
                  className={`inbox-item${notification.readAt ? " read" : " unread"}${isSelected ? " selected" : ""}`}
                  key={notification.id}
                >
                  <WorkspaceButton
                    aria-pressed={isSelected}
                    data-inbox-item-select=""
                    onClick={() => selectNotification(notification.id)}
                    size="lg"
                    type="button"
                    variant="ghost"
                    workspace
                  >
                    <span aria-hidden="true" className="ndot" />
                    {notification.actorName ? (
                      <Avatar className="inbox-avatar">
                        <AvatarFallback>
                          {getInitials(notification.actorName)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <span aria-hidden="true" className="inbox-system-icon">
                        <Bell />
                      </span>
                    )}
                    <span className="inbox-item-copy">
                      <span className="inbox-item-title">
                        {notification.text}
                      </span>
                      {notification.snippet ? (
                        <span className="inbox-item-snippet">
                          {notification.snippet}
                        </span>
                      ) : null}
                      <span className="inbox-item-meta">
                        {notification.projectName ? (
                          <span className="inbox-item-project">
                            {notification.projectName}
                          </span>
                        ) : null}
                        <time
                          className="inbox-item-time"
                          dateTime={notification.createdAt}
                          title={DATE_FORMATTER.format(
                            new Date(notification.createdAt)
                          )}
                        >
                          {formatRelativeTime(notification.createdAt)}
                        </time>
                      </span>
                    </span>
                  </WorkspaceButton>
                  {notification.readAt === null ? (
                    <WorkspaceButton
                      aria-label={`Mark as read: ${notification.text}`}
                      className="inbox-item-read"
                      disabled={pending}
                      onClick={() => markRead(notification.id)}
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
          <EmptyState
            action={
              filter !== "all" || unreadOnly ? (
                <WorkspaceButton
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    updateUrl("type", null);
                    updateUrl("unread", null);
                  }}
                  type="button"
                >
                  Clear filters
                </WorkspaceButton>
              ) : null
            }
            description="New mentions, assignments and updates land here."
            icon={Tray}
            title="No notifications match this filter"
          />
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

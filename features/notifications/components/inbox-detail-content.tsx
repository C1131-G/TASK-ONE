/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

import { EnvelopeOpen } from "@phosphor-icons/react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import {
  DATE_FORMATTER,
  formatRelativeTime,
  getInitials,
} from "@/features/notifications/inbox-format";
import type { NotificationItem } from "@/src/server/notifications/contracts";

const InboxDetailContent = ({
  item,
  pending,
  onMarkRead,
}: {
  readonly item: NotificationItem | null;
  readonly pending: boolean;
  readonly onMarkRead: (notificationId: string) => void;
}) =>
  item ? (
    <div className="inbox-detail-body">
      {item.actorName ? (
        <div className="row">
          <Avatar className="inbox-avatar">
            <AvatarFallback>{getInitials(item.actorName)}</AvatarFallback>
          </Avatar>
          <span>{item.actorName}</span>
        </div>
      ) : null}
      <h3>{item.text}</h3>
      {item.snippet ? <p>{item.snippet}</p> : null}
      <time
        dateTime={item.createdAt}
        title={DATE_FORMATTER.format(new Date(item.createdAt))}
      >
        {formatRelativeTime(item.createdAt)}
      </time>
      {item.projectName && item.projectId ? (
        <Link
          className="btn btn-secondary"
          href={`/projects/${item.projectId}?view=board`}
        >
          Open {item.projectName}
        </Link>
      ) : null}
      {item.readAt === null ? (
        <WorkspaceButton
          disabled={pending}
          onClick={() => onMarkRead(item.id)}
          type="button"
          variant="secondary"
        >
          Mark as read
        </WorkspaceButton>
      ) : null}
    </div>
  ) : (
    <div className="inbox-detail-empty">
      <EnvelopeOpen aria-hidden="true" size={24} />
      <h2>Select a notification</h2>
      <p>Choose a notification to review its details.</p>
    </div>
  );

export { InboxDetailContent };

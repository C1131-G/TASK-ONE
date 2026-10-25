import type { MockFixture } from "@/api/mock/mock-fetch";

export const INBOX_ITEMS = [
  {
    createdAt: "2026-10-24T09:15:00.000Z",
    id: "notif-1",
    kind: "assignment",
    readAt: null,
    taskId: "task-1",
    taskTitle: "Ship the landing page",
    title: "Ada assigned you a task",
  },
  {
    createdAt: "2026-10-24T08:00:00.000Z",
    id: "notif-2",
    kind: "mention",
    readAt: null,
    taskId: "task-1",
    taskTitle: "Ship the landing page",
    title: "Grace mentioned you",
  },
  {
    createdAt: "2026-10-23T17:30:00.000Z",
    id: "notif-3",
    kind: "comment",
    readAt: "2026-10-23T18:00:00.000Z",
    taskId: "task-2",
    taskTitle: "Draft the announcement",
    title: "New comment on your task",
  },
];

export const NOTIFICATION_FIXTURES: readonly MockFixture[] = [
  {
    data: { items: INBOX_ITEMS, unread: 2 },
    operationId: "listInbox",
  },
  {
    data: { id: "notif-1", readAt: "2026-10-25T09:00:00.000Z" },
    operationId: "markInboxItemRead",
  },
  { data: { unread: 0 }, operationId: "markAllInboxRead" },
];

import type { MockFixture } from "@/api/mock/mock-fetch";

const IDS = {
  assignment: "a1b2c3d4-0001-4a5b-8c6d-7e8f9a0b1c01",
  comment: "a1b2c3d4-0003-4a5b-8c6d-7e8f9a0b1c03",
  mention: "a1b2c3d4-0002-4a5b-8c6d-7e8f9a0b1c02",
} as const;

const TASK_ONE = "3f0c2b6e-1d4a-4c8e-9a51-7b2d6e8f0a11";
const TASK_TWO = "3f0c2b6e-1d4a-4c8e-9a51-7b2d6e8f0a12";

export const INBOX_ITEMS = [
  {
    actorId: null,
    actorName: "Ada Lovelace",
    createdAt: "2026-10-24T09:15:00.000Z",
    id: IDS.assignment,
    projectId: null,
    projectName: "Website relaunch",
    readAt: null,
    snippet: null,
    taskId: TASK_ONE,
    text: "Ada assigned you a task",
    type: "assignment",
  },
  {
    actorId: null,
    actorName: "Grace Hopper",
    createdAt: "2026-10-24T08:00:00.000Z",
    id: IDS.mention,
    projectId: null,
    projectName: "Website relaunch",
    readAt: null,
    snippet: "Can you check the hero copy?",
    taskId: TASK_ONE,
    text: "Grace mentioned you",
    type: "mention",
  },
  {
    actorId: null,
    actorName: null,
    createdAt: "2026-10-23T17:30:00.000Z",
    id: IDS.comment,
    projectId: null,
    projectName: null,
    readAt: "2026-10-23T18:00:00.000Z",
    snippet: null,
    taskId: TASK_TWO,
    text: "New comment on your task",
    type: "comment",
  },
];

export const NOTIFICATION_FIXTURES: readonly MockFixture[] = [
  {
    data: { items: INBOX_ITEMS, nextCursor: null, unreadCount: 2, unreadInboxCount: 2 },
    operationId: "listWorkspaceNotifications",
  },
  { data: { done: true }, operationId: "markWorkspaceNotificationRead" },
  { data: { count: 2 }, operationId: "markAllWorkspaceNotificationsRead" },
];

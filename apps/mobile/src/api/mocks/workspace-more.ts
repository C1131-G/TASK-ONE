import type { MockFixture } from "@/api/mock/mock-fetch";

export const WORKSPACE_MORE_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [
        {
          bugTitle: "Login rejects valid passwords on Android",
          id: "ba-1",
          projectName: "Website relaunch",
          reportedBy: "Client Carl",
          status: "pending",
        },
        {
          bugTitle: "Approval button double-fires",
          id: "ba-2",
          projectName: "Client portal",
          reportedBy: "Client Carl",
          status: "approved",
        },
      ],
    },
    operationId: "listBugApprovals",
  },
  {
    data: {
      items: [
        {
          createdAt: "2026-10-24T09:15:00.000Z",
          id: "wn-1",
          kind: "assignment",
          readAt: null,
          title: "Ada assigned you a task",
        },
        {
          createdAt: "2026-10-23T17:30:00.000Z",
          id: "wn-2",
          kind: "comment",
          readAt: "2026-10-23T18:00:00.000Z",
          title: "New comment on your task",
        },
      ],
    },
    operationId: "listNotifications",
  },
];

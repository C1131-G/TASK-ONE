import type { MockFixture } from "@/api/mock/mock-fetch";

export const WORKSPACE_MORE_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [
        {
          bugTitle: "Login rejects valid passwords on Android",
          id: "7a2c9d10-3e5b-4f8a-b1c2-0d4e6f8a1b01",
          projectName: "Website relaunch",
          reportedBy: "Client Carl",
          status: "pending",
        },
        {
          bugTitle: "Approval button double-fires",
          id: "7a2c9d10-3e5b-4f8a-b1c2-0d4e6f8a1b02",
          projectName: "Client portal",
          reportedBy: "Client Carl",
          status: "approved",
        },
      ],
      nextCursor: null,
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

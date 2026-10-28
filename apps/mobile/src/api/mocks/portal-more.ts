import type { MockFixture } from "@/api/mock/mock-fetch";

export const PORTAL_MORE_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [
        {
          id: "9e4b7c20-6d1a-4a3f-8c55-1b2d3e4f5a01",
          projectName: "Website relaunch",
          requestedBy: "Ada Lovelace",
          status: "pending",
          title: "Extra landing page revision",
        },
        {
          id: "9e4b7c20-6d1a-4a3f-8c55-1b2d3e4f5a02",
          projectName: "Client portal",
          requestedBy: "Grace Hopper",
          status: "approved",
          title: "Budget extension for QA",
        },
      ],
      nextCursor: null,
    },
    operationId: "listPortalApprovals",
  },
  {
    data: {
      items: [
        {
          approvalId: null,
          bugId: "5d1e3f7a-2b44-4d6e-8a10-9c7b2e4f1a01",
          createdAt: "2026-10-24T09:00:00.000Z",
          id: "c3d5e7f9-1a2b-4c4d-8e6f-7a8b9c0d1e01",
          readAt: null,
          snippet: null,
          text: "Your bug report was confirmed",
          title: "Your bug report was confirmed",
        },
        {
          approvalId: null,
          bugId: null,
          createdAt: "2026-10-23T12:00:00.000Z",
          id: "c3d5e7f9-1a2b-4c4d-8e6f-7a8b9c0d1e02",
          readAt: "2026-10-23T13:00:00.000Z",
          snippet: "Weekly digest",
          text: "Weekly digest is ready",
          title: "Weekly digest is ready",
        },
      ],
      nextCursor: null,
      unreadCount: 1,
    },
    operationId: "listPortalNotifications",
  },
];

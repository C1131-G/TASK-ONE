import type { MockFixture } from "@/api/mock/mock-fetch";

export const PORTAL_MORE_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [
        {
          id: "ap-1",
          projectName: "Website relaunch",
          requestedBy: "Ada Lovelace",
          status: "pending",
          title: "Extra landing page revision",
        },
        {
          id: "ap-2",
          projectName: "Client portal",
          requestedBy: "Grace Hopper",
          status: "approved",
          title: "Budget extension for QA",
        },
      ],
    },
    operationId: "listPortalApprovals",
  },
  {
    data: {
      items: [
        {
          createdAt: "2026-10-24T09:00:00.000Z",
          id: "pn-1",
          readAt: null,
          title: "Your bug report was confirmed",
        },
        {
          createdAt: "2026-10-23T12:00:00.000Z",
          id: "pn-2",
          readAt: "2026-10-23T13:00:00.000Z",
          title: "Weekly digest is ready",
        },
      ],
    },
    operationId: "listPortalNotifications",
  },
];

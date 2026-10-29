import type { MockFixture } from "@/api/mock/mock-fetch";

export const PORTAL_PROJECT_ID = "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c05";
const BUG_ID = "c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f";
const PERSON = "9c2e4d71-8b3a-4e65-a1f0-2d7c5b9e8a30";

export const PORTAL_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [{ id: PORTAL_PROJECT_ID, key: "WEB", name: "Website relaunch" }],
      nextCursor: null,
    },
    operationId: "listPortalProjects",
  },
  // Live shapes, used by tests.
  {
    data: {
      items: [
      {
        createdAt: "2026-10-20T09:30:00.000Z",
        id: BUG_ID,
        impact: "high",
        isMine: true,
        key: "WEB-B7",
        projectId: PORTAL_PROJECT_ID,
        projectName: "Website relaunch",
        reporterName: "Ada Lovelace",
        status: "acknowledged",
        title: "Login rejects valid passwords on Android",
        updatedAt: "2026-10-21T08:00:00.000Z",
      },
      ],
      nextCursor: null,
    },
    operationId: "listPortalBugPage",
  },
  { data: { bugId: PERSON, version: 1 }, operationId: "submitPortalBug" },
];

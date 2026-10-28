import type { MockFixture } from "@/api/mock/mock-fetch";

export const PORTAL_PROJECT_ID = "0b6c8a52-5f1e-4c0e-9a33-6a0f1d2c7e11";

export const PORTAL_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      projects: [
        { id: "proj-1", key: "WEB", name: "Website relaunch", openTasks: 4, progress: 62 },
      ],
    },
    operationId: "listPortalProjects",
  },
  {
    // The live list is a plain array of the company's bug summaries.
    data: [
      {
        createdAt: "2026-10-20T09:00:00.000Z",
        id: "5d1e3f7a-2b44-4d6e-8a10-9c7b2e4f1a01",
        impact: "high",
        isMine: true,
        key: "WEB-12",
        projectId: PORTAL_PROJECT_ID,
        projectName: "Website relaunch",
        reporterName: "Client Carl",
        status: "in_progress",
        title: "Login rejects valid passwords on Android",
        updatedAt: "2026-10-24T10:30:00.000Z",
      },
    ],
    operationId: "listPortalBugs",
  },
  { data: { id: "bug-new" }, operationId: "createPortalBug" },
];

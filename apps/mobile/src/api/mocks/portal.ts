import type { MockFixture } from "@/api/mock/mock-fetch";

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
    data: {
      bugs: [
        {
          id: "bug-1",
          priority: "high",
          projectId: "proj-1",
          projectName: "Website relaunch",
          status: "open",
          title: "Login rejects valid passwords on Android",
        },
      ],
    },
    operationId: "listPortalBugs",
  },
  { data: { id: "bug-new" }, operationId: "createPortalBug" },
];

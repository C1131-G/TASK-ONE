import type { MockFixture } from "@/api/mock/mock-fetch";

export const WORKSPACE_FIXTURES: readonly MockFixture[] = [
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
        {
          id: "bug-2",
          priority: "medium",
          projectId: "proj-2",
          projectName: "Client portal",
          status: "confirmed",
          title: "Approval button double-fires",
        },
      ],
    },
    operationId: "listBugs",
  },
  {
    data: {
      projects: [
        { id: "proj-1", key: "WEB", name: "Website relaunch", openTasks: 4, progress: 62 },
        { id: "proj-2", key: "PORT", name: "Client portal", openTasks: 9, progress: 30 },
      ],
    },
    operationId: "listProjects",
  },
];

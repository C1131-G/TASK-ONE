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
      items: [
        { clientVisible: true, dueDate: null, id: "proj-1", key: "WEB", name: "Website relaunch", openTaskCount: 4, overdueTaskCount: 0, progress: 62, status: "active", taskCount: 10 },
        { clientVisible: false, dueDate: "2026-12-01", id: "proj-2", key: "PORT", name: "Client portal", openTaskCount: 9, overdueTaskCount: 2, progress: 30, status: "risk", taskCount: 13 },
      ],
      nextCursor: null,
    },
    operationId: "listProjects",
  },
];

import type { MockFixture } from "@/api/mock/mock-fetch";

export const WORKSPACE_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      items: [
        { clientCompanyName: "Northwind", id: "b1f3c2d4-5a6b-4c7d-8e9f-0a1b2c3d4e01", permittedActions: ["pick"], priority: "high", reference: "WEB-B7", severity: "major", sla: null, status: "triaged", title: "Login rejects valid passwords on Android", updatedAt: "2026-10-24T10:30:00.000Z", version: 2 },
        { clientCompanyName: null, id: "b1f3c2d4-5a6b-4c7d-8e9f-0a1b2c3d4e02", permittedActions: [], priority: "medium", reference: "PORT-B2", severity: "minor", sla: null, status: "in_progress", title: "Approval button double-fires", updatedAt: "2026-10-23T09:00:00.000Z", version: 1 },
      ],
      nextCursor: null,
    },
    operationId: "listWorkspaceBugs",
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

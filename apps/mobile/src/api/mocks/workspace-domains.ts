import type { MockFixture } from "@/api/mock/mock-fetch";

/** Fixtures for the workspace's still-pending domains. */
export const WORKSPACE_DOMAIN_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      people: [
        { id: "p-1", loadHours: 31, name: "Ada Lovelace", openTasks: 6, overHours: 3 },
        { id: "p-2", loadHours: 12, name: "Grace Hopper", openTasks: 2, overHours: 0 },
        { id: "p-3", loadHours: 0, name: "Alan Turing", openTasks: 0, overHours: 0 },
      ],
    },
    operationId: "listWorkload",
  },
  {
    data: {
      entries: [
        { date: "2026-10-24", hours: 3.5, id: "te-1", projectName: "Website relaunch", taskId: "task-1", taskTitle: "Ship the landing page" },
        { date: "2026-10-23", hours: 5, id: "te-2", projectName: "Client portal", taskId: null, taskTitle: null },
      ],
    },
    operationId: "listMyTime",
  },
  {
    data: {
      files: [
        { copyStatus: "none", id: "f-1", name: "brand-guidelines.pdf", projectId: "proj-1", projectName: "Website relaunch", sizeLabel: "2.4 MB", uploadedBy: "Ada Lovelace" },
        { copyStatus: "ready", id: "f-2", name: "launch-shot.png", projectId: "proj-1", projectName: "Website relaunch", sizeLabel: "812 KB", uploadedBy: "Grace Hopper" },
      ],
    },
    operationId: "listFiles",
  },
  {
    data: {
      members: [
        { employeeNumber: "EMP000001", id: "p-1", name: "Ada Lovelace", role: "admin", teamName: "Design", title: "Lead designer" },
        { employeeNumber: "EMP000002", id: "p-2", name: "Grace Hopper", role: "employee", teamName: "Engineering", title: "Engineer" },
        { employeeNumber: "EMP000003", id: "p-3", name: "Alan Turing", role: "employee", teamName: null, title: null },
      ],
    },
    operationId: "listMembers",
  },
  {
    data: {
      teams: [
        { id: "t-1", memberCount: 3, name: "Design" },
        { id: "t-2", memberCount: 4, name: "Engineering" },
      ],
    },
    operationId: "listTeams",
  },
  {
    data: {
      companies: [
        { active: true, contactEmail: "ops@northwind.test", id: "c-1", name: "Northwind" },
        { active: false, contactEmail: null, id: "c-2", name: "Contoso" },
      ],
    },
    operationId: "listClientCompanies",
  },
  {
    data: {
      items: [
        { actorName: "Grace Hopper", at: "2026-10-24T15:02:00.000Z", detail: "moved Ship the landing page to review", id: "a-1", kind: "moved", taskTitle: "Ship the landing page" },
        { actorName: "Ada Lovelace", at: "2026-10-24T09:15:00.000Z", detail: "commented on Draft the announcement", id: "a-2", kind: "comment", taskTitle: "Draft the announcement" },
      ],
    },
    operationId: "listActivity",
  },
  {
    data: {
      items: [
        { id: "fav-1", kind: "project", subtitle: "4 open · 62%", title: "WEB Website relaunch" },
        { id: "fav-2", kind: "task", subtitle: "In progress", title: "Ship the landing page" },
      ],
    },
    operationId: "listFavorites",
  },
  {
    data: {
      items: [
        { archivedAt: "2026-09-30T10:00:00.000Z", id: "ar-1", kind: "project", title: "Old marketing site" },
        { archivedAt: "2026-10-02T08:30:00.000Z", id: "ar-2", kind: "task", title: "Audit deprecated endpoints" },
      ],
    },
    operationId: "listArchive",
  },
  {
    data: {
      hits: [
        { id: "s-1", kind: "task", subtitle: "Website relaunch", title: "Ship the landing page" },
        { id: "s-2", kind: "project", subtitle: "4 open", title: "Website relaunch" },
      ],
    },
    operationId: "searchWorkspace",
  },
  {
    data: {
      budgets: [
        { billedHours: 41, id: "b-1", plannedHours: 60, projectName: "Website relaunch" },
        { billedHours: 88, id: "b-2", plannedHours: 80, projectName: "Client portal" },
      ],
    },
    operationId: "listBudgets",
  },
];

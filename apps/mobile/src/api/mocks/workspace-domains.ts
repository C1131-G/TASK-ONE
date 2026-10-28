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
      items: [
        { activeProjectCount: 3, email: "ada@example.test", employeeId: "EMP000001", id: "p-1", jobTitle: "Lead designer", name: "Ada Lovelace", openAssignedTaskCount: 6, role: "admin", teamId: "t-1", teamName: "Design" },
        { activeProjectCount: 2, email: "grace@example.test", employeeId: "EMP000002", id: "p-2", jobTitle: "Engineer", name: "Grace Hopper", openAssignedTaskCount: 2, role: "employee", teamId: "t-2", teamName: "Engineering" },
        { activeProjectCount: 0, email: "alan@example.test", employeeId: "EMP000003", id: "p-3", jobTitle: null, name: "Alan Turing", openAssignedTaskCount: 0, role: "employee", teamId: null, teamName: null },
      ],
      nextCursor: null,
    },
    operationId: "listMembers",
  },
  {
    data: {
      items: [
        { color: "#3b82f6", description: null, id: "t-1", memberCount: 3, name: "Design" },
        { color: "#10b981", description: "Builds the product", id: "t-2", memberCount: 4, name: "Engineering" },
      ],
      nextCursor: null,
    },
    operationId: "listTeams",
  },
  {
    data: {
      items: [
        { active: true, handlerCount: 2, id: "c-1", name: "Northwind", openBugCount: 3, projectCount: 2, userCount: 4, version: 1 },
        { active: false, handlerCount: 0, id: "c-2", name: "Contoso", openBugCount: 0, projectCount: 0, userCount: 1, version: 2 },
      ],
      nextCursor: null,
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
      items: [
        { billableOnly: false, budgetAmountCents: null, budgetMinutes: 3600, currency: "USD", hourlyRateCents: null, kind: "one_off", level: "ok", percent: 68, period: { from: null, key: "all", to: null }, projectId: "proj-1", projectKey: "WEB", projectName: "Website relaunch", remainingMinutes: 1140, spentAmountCents: null, spentMinutes: 2460, warningPercent: 80 },
        { billableOnly: false, budgetAmountCents: null, budgetMinutes: 4800, currency: "USD", hourlyRateCents: null, kind: "retainer", level: "overrun", percent: 110, period: { from: "2026-10-01", key: "2026-10", to: "2026-10-31" }, projectId: "proj-2", projectKey: "PORT", projectName: "Client portal", remainingMinutes: 0, spentAmountCents: null, spentMinutes: 5280, warningPercent: 80 },
      ],
      nextCursor: null,
    },
    operationId: "listBudgets",
  },
];

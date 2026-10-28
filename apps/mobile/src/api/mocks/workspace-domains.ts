import type { MockFixture } from "@/api/mock/mock-fetch";

/** Fixtures for the workspace's still-pending domains. */
export const WORKSPACE_DOMAIN_FIXTURES: readonly MockFixture[] = [
  {
    data: {
      people: [
        { name: "Ada Lovelace", overdueCount: 1, overloadedWeekCount: 1, peakLoadHours: 31, unscheduled: { loadHours: 0, taskCount: 1 }, userId: "p-1", weeks: [{ loadHours: 31, overloaded: true, taskCount: 5, weekStart: "2026-10-26" }] },
        { name: "Grace Hopper", overdueCount: 0, overloadedWeekCount: 0, peakLoadHours: 12, unscheduled: { loadHours: 0, taskCount: 0 }, userId: "p-2", weeks: [{ loadHours: 12, overloaded: false, taskCount: 2, weekStart: "2026-10-26" }] },
        { name: "Alan Turing", overdueCount: 0, overloadedWeekCount: 0, peakLoadHours: 0, unscheduled: { loadHours: 0, taskCount: 0 }, userId: "p-3", weeks: [{ loadHours: 0, overloaded: false, taskCount: 0, weekStart: "2026-10-26" }] },
      ],
      capacityHours: 30,
      weeks: ["2026-10-26"],
    },
    operationId: "listWorkload",
  },
  {
    data: {
      billableMinutes: 210,
      days: [{ date: "2026-10-24", minutes: 210 }],
      entries: [
        { billable: true, id: "te-1", minutes: 210, note: null, taskId: "task-1", taskReference: "WEB-1", taskTitle: "Ship the landing page", userId: "p-1", userName: "Ada Lovelace", workDate: "2026-10-24" },
        { billable: false, id: "te-2", minutes: 300, note: null, taskId: "task-2", taskReference: "PORT-3", taskTitle: "Set up the staging database", userId: "p-1", userName: "Ada Lovelace", workDate: "2026-10-23" },
      ],
      totalMinutes: 510,
      weekStart: "2026-10-19",
    },
    operationId: "listMyTime",
  },
  {
    data: {
      items: [
        { contentType: "application/pdf", copyState: "ready", createdAt: "2026-10-20T09:00:00.000Z", id: "f-1", originalName: "brand-guidelines.pdf", projectId: "proj-1", projectName: "Website relaunch", sizeBytes: 2516582, taskId: null, uploadedById: "p-1" },
        { contentType: "image/png", copyState: "pending", createdAt: "2026-10-19T09:00:00.000Z", id: "f-2", originalName: "launch-shot.png", projectId: "proj-1", projectName: "Website relaunch", sizeBytes: 831488, taskId: null, uploadedById: "p-2" },
      ],
      nextCursor: null,
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
        { action: "task_moved", actorId: "p-2", actorName: "Grace Hopper", createdAt: "2026-10-24T15:02:00.000Z", id: "a-1", projectId: "proj-1", projectName: "Website relaunch", taskId: "task-1", taskTitle: "Ship the landing page" },
        { action: "comment_added", actorId: "p-1", actorName: "Ada Lovelace", createdAt: "2026-10-24T09:15:00.000Z", id: "a-2", projectId: "proj-1", projectName: "Website relaunch", taskId: null, taskTitle: null },
      ],
      nextCursor: null,
    },
    operationId: "listActivity",
  },
  {
    data: {
      items: [
        { id: "fav-1", kind: "project", subtitle: null, title: "Website relaunch" },
        { id: "fav-2", kind: "task", subtitle: "Website relaunch", title: "Ship the landing page" },
      ],
      nextCursor: null,
    },
    operationId: "listFavorites",
  },
  {
    data: {
      items: [
        { archivedAt: "2026-10-02T08:30:00.000Z", id: "ar-2", kind: "task", projectName: "Website relaunch", title: "Audit deprecated endpoints", version: 2 },
        { archivedAt: "2026-09-30T10:00:00.000Z", id: "ar-1", kind: "project", projectName: null, title: "Old marketing site", version: 4 },
      ],
      nextCursor: null,
    },
    operationId: "listArchive",
  },
  {
    data: {
      projects: [{ id: "proj-1", name: "Website relaunch" }],
      tasks: [{ id: "task-1", projectId: "proj-1", projectName: "Website relaunch", title: "Ship the landing page" }],
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

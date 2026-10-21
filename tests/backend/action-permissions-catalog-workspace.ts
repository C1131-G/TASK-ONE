import { randomUUID } from "node:crypto";

import { entry, eventBody } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const calendar = await import("../../features/calendar/calendar-actions");
const comments = await import("../../features/tasks/actions/tasks-comments");
const companySettings =
  await import("../../features/settings/settings-actions");
const discovery = await import("../../features/discovery/discovery-actions");
const employees = await import("../../features/people/people-actions");
const labels = await import("../../features/tasks/actions/tasks-labels");
const notifications =
  await import("../../features/notifications/notifications-actions");
const activityQueries =
  await import("../../features/activity/activity-queries");
const calendarQueries =
  await import("../../features/calendar/calendar-queries");
const companyQueries = await import("../../features/settings/settings-queries");
const dashboardQueries =
  await import("../../features/dashboard/dashboard-queries");
const discoveryQueries =
  await import("../../features/discovery/discovery-queries");
const jobsQueries = await import("../../features/settings/settings-queries");
const notificationsQueries =
  await import("../../features/notifications/notifications-queries");
const peopleQueries = await import("../../features/people/people-queries");
const tasks = await import("../../features/tasks/tasks-actions");
const tasksQueries = await import("../../features/tasks/tasks-queries");

export const workspaceActionCatalog: readonly ActionEntry[] = [
  entry("listTaskCalendar", calendarQueries.listTaskCalendar, () => ({
    from: "2026-10-01",
    groupBy: "status",
    limit: 100,
    priorities: [],
    sortBy: "dueDate",
    sortDirection: "asc",
    statuses: [],
    to: "2026-12-31",
  })),
  entry("listActivity", activityQueries.listActivity, () => ({
    taskId: ids.taskId,
  })),
  entry("listCalendarEvents", calendarQueries.listCalendarEvents, () => ({
    from: "2026-01-01T00:00:00.000Z",
    to: "2026-02-01T00:00:00.000Z",
  })),
  entry(
    "createCalendarEventAction",
    calendar.createCalendarEventAction,
    () => ({
      ...eventBody(),
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "updateCalendarEventAction",
    calendar.updateCalendarEventAction,
    () => ({
      ...eventBody(),
      eventId: ids.random,
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "deleteCalendarEventAction",
    calendar.deleteCalendarEventAction,
    () => ({
      eventId: ids.random,
      idempotencyKey: nextKey(),
    })
  ),
  entry("listTaskCommentsAction", comments.listTaskCommentsAction, () => ({
    taskId: ids.taskId,
  })),
  entry("createCommentAction", comments.createCommentAction, () => ({
    body: "Permission comment",
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("removeCommentAction", comments.removeCommentAction, () => ({
    commentId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry("undoCommentRemovalAction", comments.undoCommentRemovalAction, () => ({
    idempotencyKey: nextKey(),
    undoId: ids.random,
  })),
  entry(
    "toggleCommentReactionAction",
    comments.toggleCommentReactionAction,
    () => ({
      commentId: ids.random,
      emoji: "👍",
      idempotencyKey: nextKey(),
    })
  ),
  entry("getCompanySettings", companyQueries.getCompanySettings, () => ({})),
  entry(
    "getCalendarFeedStatus",
    companyQueries.getCalendarFeedStatus,
    () => ({})
  ),
  entry(
    "rotateCalendarFeedAction",
    companySettings.rotateCalendarFeedAction,
    () => ({})
  ),
  entry(
    "revokeCalendarFeedAction",
    companySettings.revokeCalendarFeedAction,
    () => ({})
  ),
  entry("getTasksCsvExportAction", tasks.getTasksCsvExportAction, () => ({})),
  entry("importTasksCsvAction", tasks.importTasksCsvAction, () => ({
    idempotencyKey: nextKey(),
    projectId: ids.projectId,
    text: "title\nImported by permission test\n",
  })),
  entry(
    "updateCompanySettingsAction",
    companySettings.updateCompanySettingsAction,
    () => ({
      brandColor: "#336699",
      brandEnabled: true,
      idempotencyKey: nextKey(),
      name: "Permission Co",
      slug: "permission-co",
      timeZone: "Asia/Kolkata",
    })
  ),
  entry(
    "getDashboardOverview",
    dashboardQueries.getDashboardOverview,
    () => ({})
  ),
  entry(
    "getPersonalWorkspace",
    discoveryQueries.getPersonalWorkspace,
    () => ({})
  ),
  entry(
    "toggleProjectFavoriteAction",
    discovery.toggleProjectFavoriteAction,
    () => ({
      idempotencyKey: nextKey(),
      projectId: ids.projectId,
    })
  ),
  entry("toggleTaskFavoriteAction", discovery.toggleTaskFavoriteAction, () => ({
    idempotencyKey: nextKey(),
    taskId: ids.taskId,
  })),
  entry("searchWorkspaceAction", discovery.searchWorkspaceAction, () => ({
    query: "permission",
  })),
  entry("recordRecentSearchAction", discovery.recordRecentSearchAction, () => ({
    query: "permission",
  })),
  entry("listEmployees", peopleQueries.listEmployees, () => ({
    search: "",
  })),
  entry("createEmployeeAction", employees.createEmployeeAction, () => ({
    email: `new-${randomUUID()}@permissions.example`,
    jobTitle: null,
    name: "New Person",
    role: "employee",
    teamId: null,
  })),
  entry("deactivateEmployeeAction", employees.deactivateEmployeeAction, () => ({
    employeeId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry("reactivateEmployeeAction", employees.reactivateEmployeeAction, () => ({
    employeeId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry("changeEmployeeRoleAction", employees.changeEmployeeRoleAction, () => ({
    employeeId: ids.random,
    idempotencyKey: nextKey(),
    role: "employee",
  })),
  entry(
    "resetEmployeePasswordAction",
    employees.resetEmployeePasswordAction,
    () => ({ employeeId: ids.random })
  ),
  entry(
    "updateEmployeeDetailsAction",
    employees.updateEmployeeDetailsAction,
    () => ({
      email: `detail-${randomUUID()}@permissions.example`,
      employeeId: ids.random,
      idempotencyKey: nextKey(),
      jobTitle: null,
      teamId: null,
    })
  ),
  entry("updateOwnProfileAction", employees.updateOwnProfileAction, () => ({
    idempotencyKey: nextKey(),
    name: "Permission Name",
  })),
  entry("listDeadJobs", jobsQueries.listDeadJobs, () => ({ limit: 5 })),
  entry("listLabelsAction", tasks.listLabelsAction, () => ({})),
  entry("listLabels", tasksQueries.listLabels, () => ({})),
  entry("createLabelAction", labels.createLabelAction, () => ({
    color: "#16a34a",
    idempotencyKey: nextKey(),
    name: `perm-${randomUUID().slice(0, 8)}`,
  })),
  entry("updateLabelAction", labels.updateLabelAction, () => ({
    idempotencyKey: nextKey(),
    label: { color: "#16a34a", name: "renamed" },
    labelId: ids.random,
  })),
  entry("removeLabelAction", labels.removeLabelAction, () => ({
    idempotencyKey: nextKey(),
    labelId: ids.random,
  })),
  entry(
    "listNotificationInbox",
    notificationsQueries.listNotificationInbox,
    () => ({ limit: 10, unreadOnly: false })
  ),
  entry(
    "getNotificationPreferences",
    notificationsQueries.getNotificationPreferences,
    () => ({})
  ),
  entry(
    "markNotificationReadAction",
    notifications.markNotificationReadAction,
    () => ({
      idempotencyKey: nextKey(),
      notificationId: ids.random,
    })
  ),
];

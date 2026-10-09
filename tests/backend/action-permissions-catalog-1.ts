import { randomUUID } from "node:crypto";

import { entry, eventBody } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const calendar = await import("../../app/actions/calendar");
const activity = await import("../../app/actions/activity");
const comments = await import("../../app/actions/comments");
const companySettings = await import("../../app/actions/company-settings");
const dashboard = await import("../../app/actions/dashboard");
const discovery = await import("../../app/actions/discovery");
const employees = await import("../../app/actions/employees");
const jobs = await import("../../app/actions/jobs");
const labels = await import("../../app/actions/labels");
const notifications = await import("../../app/actions/notifications");
const taskCalendar = await import("../../app/actions/task-calendar");

export const actionCatalog1: readonly ActionEntry[] = [
  entry("listTaskCalendarAction", taskCalendar.listTaskCalendarAction, () => ({
    from: "2026-10-01",
    groupBy: "status",
    limit: 100,
    priorities: [],
    sortBy: "dueDate",
    sortDirection: "asc",
    statuses: [],
    to: "2026-12-31",
  })),
  entry("listActivityAction", activity.listActivityAction, () => ({
    taskId: ids.taskId,
  })),
  entry("listCalendarEventsAction", calendar.listCalendarEventsAction, () => ({
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
  entry(
    "getCompanySettingsAction",
    companySettings.getCompanySettingsAction,
    () => ({})
  ),
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
    "getDashboardOverviewAction",
    dashboard.getDashboardOverviewAction,
    () => ({})
  ),
  entry(
    "getPersonalWorkspaceAction",
    discovery.getPersonalWorkspaceAction,
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
  entry("listEmployeesAction", employees.listEmployeesAction, () => ({
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
  entry("listDeadJobsAction", jobs.listDeadJobsAction, () => ({ limit: 5 })),
  entry("listLabelsAction", labels.listLabelsAction, () => ({})),
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
    "listNotificationInboxAction",
    notifications.listNotificationInboxAction,
    () => ({ limit: 10, unreadOnly: false })
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

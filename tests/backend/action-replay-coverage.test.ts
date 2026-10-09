import { expect, it } from "bun:test";

const calendar = await import("../../app/actions/calendar");
const comments = await import("../../app/actions/comments");
const companySettings = await import("../../app/actions/company-settings");
const dashboard = await import("../../app/actions/dashboard");
const discovery = await import("../../app/actions/discovery");
const employees = await import("../../app/actions/employees");
const jobs = await import("../../app/actions/jobs");
const labels = await import("../../app/actions/labels");
const notifications = await import("../../app/actions/notifications");
const password = await import("../../app/actions/password");
const personalPreferences =
  await import("../../app/actions/personal-preferences");
const projects = await import("../../app/actions/projects");
const savedViews = await import("../../app/actions/saved-views");
const sessions = await import("../../app/actions/sessions");
const subtasks = await import("../../app/actions/subtasks");
const tasks = await import("../../app/actions/tasks");
const teams = await import("../../app/actions/teams");
const uploads = await import("../../app/actions/uploads");

const READ_ACTION_PREFIX = /^(?:get|list|search)/u;
const excludedByDesign = new Set([
  "changeOwnPasswordAction",
  "createEmployeeAction",
  "requestAvatarUploadAction",
  "requestProjectUploadAction",
  "requestTaskUploadAction",
  "resetEmployeePasswordAction",
  "revokeSessionAction",
]);
const replayedMutations = new Set([
  "archiveProjectAction",
  "archiveTaskAction",
  "bulkUpdateTasksAction",
  "changeEmployeeRoleAction",
  "changeTaskColumnAction",
  "createCalendarEventAction",
  "createCommentAction",
  "createLabelAction",
  "createProjectAction",
  "createSavedViewAction",
  "createSubtaskAction",
  "createTaskAction",
  "createTeamAction",
  "deactivateEmployeeAction",
  "deleteCalendarEventAction",
  "deleteSavedViewAction",
  "deleteTeamAction",
  "duplicateFileAction",
  "duplicateProjectAction",
  "duplicateTaskAction",
  "finalizeAvatarUploadAction",
  "finalizeUploadAction",
  "markAllNotificationsReadAction",
  "markNotificationReadAction",
  "moveTaskAction",
  "promoteSubtaskAction",
  "reactivateEmployeeAction",
  "registerPushSubscriptionAction",
  "removeCommentAction",
  "removeFileAction",
  "removeLabelAction",
  "removePushSubscriptionAction",
  "removeSubtaskAction",
  "renameFileAction",
  "reorderSubtasksAction",
  "reorderTasksAction",
  "restoreProjectAction",
  "restoreTaskAction",
  "savePersonalPreferencesAction",
  "saveProjectMilestonesAction",
  "setNotificationPreferenceAction",
  "setProjectPeopleAction",
  "setTaskRecurrenceAction",
  "setTaskRelationsAction",
  "toggleCommentReactionAction",
  "toggleProjectFavoriteAction",
  "toggleTaskFavoriteAction",
  "undoCommentRemovalAction",
  "undoFileRemovalAction",
  "undoTaskArchiveAction",
  "undoTaskCompletionAction",
  "updateCalendarEventAction",
  "updateCompanySettingsAction",
  "updateEmployeeDetailsAction",
  "updateLabelAction",
  "updateOwnProfileAction",
  "updateProjectAction",
  "updateSavedViewAction",
  "updateSubtaskAction",
  "updateTaskAction",
  "updateTeamAction",
]);

it("accounts for each Server Action as a read, an exclusion, or a replayed mutation", () => {
  const exported = new Set(
    Object.values({
      calendar,
      comments,
      companySettings,
      dashboard,
      discovery,
      employees,
      jobs,
      labels,
      notifications,
      password,
      personalPreferences,
      projects,
      savedViews,
      sessions,
      subtasks,
      tasks,
      teams,
      uploads,
    }).flatMap(Object.keys)
  );
  expect(
    [...exported].filter(
      (name) =>
        !READ_ACTION_PREFIX.test(name) &&
        !excludedByDesign.has(name) &&
        !replayedMutations.has(name)
    )
  ).toEqual([]);
  for (const name of excludedByDesign) {
    expect(replayedMutations.has(name), name).toBe(false);
  }
});

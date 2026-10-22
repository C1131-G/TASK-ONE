import { expect, it } from "bun:test";

import "./support/server-only-stub";
import { serverEntryModules } from "./support/server-entry-modules";

const READ_ACTION_PREFIX = /^(?:get|list|search)/u;
const excludedByDesign = new Set([
  "changeOwnPasswordAction",
  // Returns a one-time temporary password, like createEmployeeAction.
  "createClientUserAction",
  "createEmployeeAction",
  // Recent search writes are naturally repeat-safe and intentionally not keyed.
  "recordRecentSearchAction",
  "requestAvatarUploadAction",
  "requestProjectUploadAction",
  "requestTaskUploadAction",
  "resetEmployeePasswordAction",
  "revokeSessionAction",
  // Naturally idempotent: revoking a link that is already gone changes nothing.
  "revokeCalendarFeedAction",
  // A replay would store the one-time secret in the idempotency table.
  "rotateCalendarFeedAction",
  // Returns the one-time signing secret, like the calendar feed rotation.
  "createWebhookEndpointAction",
  "rotateWebhookSecretAction",
  // Both return a one-time secret that a replay would store.
  "createGithubConnectionAction",
  "rotateGithubSecretAction",
  // Clearing a lockout is naturally idempotent; a repeat records nothing.
  "unlockUserAction",
]);
const replayedMutations = new Set([
  "createCustomFieldAction",
  "updateCustomFieldAction",
  "archiveCustomFieldAction",
  "reorderCustomFieldsAction",
  "setCustomFieldValueAction",
  "clearCustomFieldValueAction",
  "requestApprovalAction",
  "cancelApprovalAction",
  "createAutomationRuleAction",
  "removeAutomationRuleAction",
  "setAutomationRuleEnabledAction",
  "updateAutomationRuleAction",
  "updateGithubConnectionAction",
  "createIntakeFormAction",
  "rotateIntakeFormAction",
  "setIntakeFormEnabledAction",
  "redeliverWebhookAction",
  "removeWebhookEndpointAction",
  "updateWebhookEndpointAction",
  "clearProjectBudgetAction",
  "saveProjectBudgetAction",
  "addTimeEntryAction",
  "deleteTimeEntryAction",
  "startTimerAction",
  "stopTimerAction",
  "updateTimeEntryAction",
  "saveTaskTableColumnWidthsAction",
  "archiveProjectAction",
  "archiveTaskAction",
  "bulkUpdateTasksAction",
  "changeEmployeeRoleAction",
  "changeTaskColumnAction",
  "createClientCompanyAction",
  "finalizeClientLogoUploadAction",
  "removeClientLogoAction",
  "requestClientLogoUploadAction",
  "updateSlaSettingsAction",
  "deactivateClientCompanyAction",
  "reactivateClientCompanyAction",
  "setClientCompanyHandlersAction",
  "setClientCompanyProjectsAction",
  "updateClientCompanyAction",
  "createCalendarEventAction",
  "createCommentAction",
  "createLabelAction",
  "createProjectAction",
  "createSavedViewAction",
  "createSubtaskAction",
  "createTaskAction",
  "importTasksCsvAction",
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
  "setEmailDigestAction",
  "setNotificationPreferenceAction",
  "setProjectPeopleAction",
  "setProjectClientVisibilityAction",
  "setTaskClientVisibilityAction",
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
  "rescheduleTaskAction",
  "updateTaskAction",
  "updateTeamAction",
]);

it("accounts for each Server Action as a read, an exclusion, or a replayed mutation", () => {
  const exported = new Set(serverEntryModules.flatMap(Object.keys));
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

import {
  clientActionCatalog,
  clientAdminOnlyNames,
} from "./action-permissions-catalog-clients";
import { personalProjectActionCatalog } from "./action-permissions-catalog-personal-projects";
import { teamFileActionCatalog } from "./action-permissions-catalog-teams-files";
import { workspaceActionCatalog } from "./action-permissions-catalog-workspace";

export const allActions = [
  ...workspaceActionCatalog,
  ...personalProjectActionCatalog,
  ...teamFileActionCatalog,
  ...clientActionCatalog,
] as const;

export const adminOnlyNames: readonly string[] = [
  "createCalendarEventAction",
  "updateCalendarEventAction",
  "deleteCalendarEventAction",
  "updateCompanySettingsAction",
  "createEmployeeAction",
  "deactivateEmployeeAction",
  "reactivateEmployeeAction",
  "changeEmployeeRoleAction",
  "resetEmployeePasswordAction",
  "updateEmployeeDetailsAction",
  "listDeadJobs",
  "createLabelAction",
  "updateLabelAction",
  "removeLabelAction",
  "createProjectAction",
  "duplicateProjectAction",
  "updateProjectAction",
  "archiveProjectAction",
  "restoreProjectAction",
  "setProjectPeopleAction",
  "saveProjectMilestonesAction",
  "listProjectBudgets",
  "saveProjectBudgetAction",
  "clearProjectBudgetAction",
  "listEmployeeSessions",
  "archiveTaskAction",
  "restoreTaskAction",
  "undoTaskArchiveAction",
  "createTeamAction",
  "updateTeamAction",
  "deleteTeamAction",
  "requestProjectUploadAction",
  "listProjectFilesAction",
  "listProjectFiles",
  ...clientAdminOnlyNames,
];

import {
  automationActionCatalog,
  automationAdminOnlyNames,
} from "./action-permissions-catalog-automation";
import {
  clientActionCatalog,
  clientAdminOnlyNames,
} from "./action-permissions-catalog-clients";
import {
  githubActionCatalog,
  githubAdminOnlyNames,
} from "./action-permissions-catalog-github";
import { personalProjectActionCatalog } from "./action-permissions-catalog-personal-projects";
import { teamFileActionCatalog } from "./action-permissions-catalog-teams-files";
import {
  webhookActionCatalog,
  webhookAdminOnlyNames,
} from "./action-permissions-catalog-webhooks";
import { workspaceActionCatalog } from "./action-permissions-catalog-workspace";

export const allActions = [
  ...automationActionCatalog,
  ...webhookActionCatalog,
  ...githubActionCatalog,
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
  "setProjectClientVisibilityAction",
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
  ...webhookAdminOnlyNames,
  ...automationAdminOnlyNames,
  ...githubAdminOnlyNames,
];

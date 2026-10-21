import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const clientLogos = await import("../../features/clients/clients-actions");
const clients = await import("../../features/clients/clients-actions");
const clientQueries = await import("../../features/clients/clients-queries");
const intake = await import("../../features/intake/intake-actions");
const intakeQueries = await import("../../features/intake/intake-queries");
const slaActions = await import("../../features/settings/settings-actions");
const slaQueries = await import("../../features/settings/settings-queries");

export const clientActionCatalog: readonly ActionEntry[] = [
  entry("listClientCompanies", clientQueries.listClientCompanies, () => ({})),
  entry("getClientCompany", clientQueries.getClientCompany, () => ({
    companyId: ids.clientCompanyId,
  })),
  entry("createClientCompanyAction", clients.createClientCompanyAction, () => ({
    idempotencyKey: nextKey(),
    name: "Harness permission company",
  })),
  entry("updateClientCompanyAction", clients.updateClientCompanyAction, () => ({
    companyId: ids.clientCompanyId,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
    name: "Harness renamed company",
  })),
  entry(
    "setClientCompanyProjectsAction",
    clients.setClientCompanyProjectsAction,
    () => ({
      companyId: ids.clientCompanyId,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      projectIds: [],
    })
  ),
  entry(
    "setClientCompanyHandlersAction",
    clients.setClientCompanyHandlersAction,
    () => ({
      companyId: ids.clientCompanyId,
      employeeIds: [],
      expectedVersion: 1,
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "deactivateClientCompanyAction",
    clients.deactivateClientCompanyAction,
    () => ({
      companyId: ids.clientCompanyId,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
    })
  ),
  entry(
    "reactivateClientCompanyAction",
    clients.reactivateClientCompanyAction,
    () => ({
      companyId: ids.clientCompanyId,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
    })
  ),
  entry("createClientUserAction", clients.createClientUserAction, () => ({
    companyId: ids.clientCompanyId,
    email: "permission-client@action-harness.example",
    name: "Permission client",
  })),
  entry("unlockUserAction", clients.unlockUserAction, () => ({
    userId: ids.employeeId,
  })),
  entry(
    "requestClientLogoUploadAction",
    clientLogos.requestClientLogoUploadAction,
    () => ({
      companyId: ids.clientCompanyId,
      contentType: "image/png",
      idempotencyKey: nextKey(),
      sizeBytes: 1024,
    })
  ),
  entry(
    "finalizeClientLogoUploadAction",
    clientLogos.finalizeClientLogoUploadAction,
    () => ({
      companyId: ids.clientCompanyId,
      expectedVersion: 1,
      idempotencyKey: nextKey(),
      uploadIntentId: ids.random,
    })
  ),
  entry("removeClientLogoAction", clientLogos.removeClientLogoAction, () => ({
    companyId: ids.clientCompanyId,
    expectedVersion: 1,
    idempotencyKey: nextKey(),
  })),
  entry("listAuditEvents", clientQueries.listAuditEvents, () => ({})),
  entry("listLockedAccounts", clientQueries.listLockedAccounts, () => ({})),
  entry("listIntakeForms", intakeQueries.listIntakeForms, () => ({})),
  entry("createIntakeFormAction", intake.createIntakeFormAction, () => ({
    clientCompanyId: ids.clientCompanyId,
    idempotencyKey: nextKey(),
    name: "Permission intake form",
    projectId: ids.projectId,
  })),
  entry("rotateIntakeFormAction", intake.rotateIntakeFormAction, () => ({
    expectedVersion: 1,
    formId: ids.random,
    idempotencyKey: nextKey(),
  })),
  entry(
    "setIntakeFormEnabledAction",
    intake.setIntakeFormEnabledAction,
    () => ({
      enabled: false,
      expectedVersion: 1,
      formId: ids.random,
      idempotencyKey: nextKey(),
    })
  ),
  entry("getSlaSettings", slaQueries.getSlaSettings, () => ({})),
  entry("updateSlaSettingsAction", slaActions.updateSlaSettingsAction, () => ({
    businessDays: [1, 2, 3, 4, 5],
    businessEndMinute: 1080,
    businessStartMinute: 540,
    businessTimeZone: null,
    idempotencyKey: nextKey(),
    slaTargets: {
      high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
      low: { firstResponseMinutes: 1440, resolutionMinutes: 14_400 },
      medium: { firstResponseMinutes: 480, resolutionMinutes: 4800 },
      urgent: { firstResponseMinutes: 60, resolutionMinutes: 480 },
    },
  })),
];

export const clientAdminOnlyNames: readonly string[] = clientActionCatalog.map(
  ({ name }) => name
);

import { entry } from "./action-permissions-shared";
import type { ActionEntry } from "./action-permissions-shared";
import { ids, nextKey } from "./support/action-harness";

const clients = await import("../../features/clients/clients-actions");
const clientQueries = await import("../../features/clients/clients-queries");

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
];

export const clientAdminOnlyNames: readonly string[] = clientActionCatalog.map(
  ({ name }) => name
);

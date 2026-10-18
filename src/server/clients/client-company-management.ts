import { Layer } from "effect";

import { setHandlers, setProjects } from "./client-company-assignments";
import { ClientCompanyManagement } from "./client-company-contracts";
import {
  createClientUser,
  createCompany,
  deactivateCompany,
  reactivateCompany,
  updateCompany,
} from "./client-company-lifecycle";
import { getCompany, listCompanies } from "./client-company-reads";

export const ClientCompanyManagementLive = Layer.succeed(
  ClientCompanyManagement,
  ClientCompanyManagement.of({
    createClientUser,
    createCompany,
    deactivateCompany,
    getCompany,
    listCompanies,
    reactivateCompany,
    setHandlers,
    setProjects,
    updateCompany,
  })
);

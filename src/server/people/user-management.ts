import { Layer } from "effect";

import { changeEmployeeRole, resetEmployeePassword } from "./user-access";
import { deactivateEmployee, reactivateEmployee } from "./user-activation";
import { UserManagement } from "./user-contracts";
import { createEmployee, createFirstAdmin } from "./user-create";
import {
  listEmployees,
  updateEmployeeDetails,
  updateOwnProfile,
} from "./user-directory";

export {
  CreateEmployeeInputSchema,
  CreatedEmployeeSchema,
  EmployeeDirectorySchema,
  UpdateOwnProfileInputSchema,
  TemporaryPasswordResultSchema,
  UserManagement,
} from "./user-contracts";
export type {
  CreateEmployeeInput,
  CreatedEmployee,
  EmployeeDirectoryEntry,
  TemporaryPasswordResult,
  UpdateOwnProfileInput,
} from "./user-contracts";

export const UserManagementLive = Layer.succeed(
  UserManagement,
  UserManagement.of({
    changeEmployeeRole,
    createEmployee,
    createFirstAdmin,
    deactivateEmployee,
    listEmployees,
    reactivateEmployee,
    resetEmployeePassword,
    updateEmployeeDetails,
    updateOwnProfile,
  })
);

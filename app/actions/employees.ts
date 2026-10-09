"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  createEmployeeAction as createEmployee,
  deactivateEmployeeAction as deactivateEmployee,
  listEmployeesAction as listEmployees,
  reactivateEmployeeAction as reactivateEmployee,
} from "./employees-part-1";
import {
  changeEmployeeRoleAction as changeRole,
  resetEmployeePasswordAction as resetPassword,
  updateEmployeeDetailsAction as updateDetails,
} from "./employees-part-2";
import { updateOwnProfileAction as updateOwnProfile } from "./employees-part-3";

export async function listEmployeesAction(input: unknown) {
  return await listEmployees(input);
}

export async function createEmployeeAction(input: unknown) {
  return await createEmployee(input);
}

export async function deactivateEmployeeAction(input: unknown) {
  return await deactivateEmployee(input);
}

export async function reactivateEmployeeAction(input: unknown) {
  return await reactivateEmployee(input);
}

export async function changeEmployeeRoleAction(input: unknown) {
  return await changeRole(input);
}

export async function resetEmployeePasswordAction(input: unknown) {
  return await resetPassword(input);
}

export async function updateEmployeeDetailsAction(input: unknown) {
  return await updateDetails(input);
}

export async function updateOwnProfileAction(input: unknown) {
  return await updateOwnProfile(input);
}

"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  changeEmployeeRoleAction as changeEmployeeRoleImpl,
  resetEmployeePasswordAction as resetEmployeePasswordImpl,
  updateEmployeeDetailsAction as updateEmployeeDetailsImpl,
} from "./actions/employee-access";
import {
  createEmployeeAction as createEmployeeImpl,
  deactivateEmployeeAction as deactivateEmployeeImpl,
  reactivateEmployeeAction as reactivateEmployeeImpl,
} from "./actions/employee-records";
import { updateOwnProfileAction as updateOwnProfileImpl } from "./actions/own-profile";
import {
  createTeamAction as createTeamImpl,
  deleteTeamAction as deleteTeamImpl,
  updateTeamAction as updateTeamImpl,
} from "./actions/teams";

export async function createEmployeeAction(input: unknown) {
  return await createEmployeeImpl(input);
}

export async function deactivateEmployeeAction(input: unknown) {
  return await deactivateEmployeeImpl(input);
}

export async function reactivateEmployeeAction(input: unknown) {
  return await reactivateEmployeeImpl(input);
}

export async function changeEmployeeRoleAction(input: unknown) {
  return await changeEmployeeRoleImpl(input);
}

export async function resetEmployeePasswordAction(input: unknown) {
  return await resetEmployeePasswordImpl(input);
}

export async function updateEmployeeDetailsAction(input: unknown) {
  return await updateEmployeeDetailsImpl(input);
}

export async function updateOwnProfileAction(input: unknown) {
  return await updateOwnProfileImpl(input);
}

export async function createTeamAction(input: unknown) {
  return await createTeamImpl(input);
}

export async function updateTeamAction(input: unknown) {
  return await updateTeamImpl(input);
}

export async function deleteTeamAction(input: unknown) {
  return await deleteTeamImpl(input);
}

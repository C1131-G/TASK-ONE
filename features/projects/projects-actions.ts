"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  clearProjectBudgetAction as clearProjectBudgetImpl,
  saveProjectBudgetAction as saveProjectBudgetImpl,
} from "./actions/projects-budgets";
import {
  restoreProjectAction as restoreProjectImpl,
  saveProjectMilestonesAction as saveProjectMilestonesImpl,
  setProjectPeopleAction as setProjectPeopleImpl,
} from "./actions/projects-people-and-milestones";
import {
  archiveProjectAction as archiveProjectImpl,
  createProjectAction as createProjectImpl,
  duplicateProjectAction as duplicateProjectImpl,
  updateProjectAction as updateProjectImpl,
} from "./actions/projects-records";
import {
  createSavedViewAction as createSavedViewImpl,
  deleteSavedViewAction as deleteSavedViewImpl,
  updateSavedViewAction as updateSavedViewImpl,
} from "./actions/projects-saved-views";

export async function createProjectAction(input: unknown) {
  return await createProjectImpl(input);
}

export async function duplicateProjectAction(input: unknown) {
  return await duplicateProjectImpl(input);
}

export async function updateProjectAction(input: unknown) {
  return await updateProjectImpl(input);
}

export async function archiveProjectAction(input: unknown) {
  return await archiveProjectImpl(input);
}

export async function restoreProjectAction(input: unknown) {
  return await restoreProjectImpl(input);
}

export async function setProjectPeopleAction(input: unknown) {
  return await setProjectPeopleImpl(input);
}

export async function saveProjectMilestonesAction(input: unknown) {
  return await saveProjectMilestonesImpl(input);
}

export async function saveProjectBudgetAction(input: unknown) {
  return await saveProjectBudgetImpl(input);
}

export async function clearProjectBudgetAction(input: unknown) {
  return await clearProjectBudgetImpl(input);
}

export async function createSavedViewAction(input: unknown) {
  return await createSavedViewImpl(input);
}

export async function updateSavedViewAction(input: unknown) {
  return await updateSavedViewImpl(input);
}

export async function deleteSavedViewAction(input: unknown) {
  return await deleteSavedViewImpl(input);
}

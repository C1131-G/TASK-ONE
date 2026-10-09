"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  archiveProjectAction as archiveProject,
  createProjectAction as createProject,
  duplicateProjectAction as duplicateProject,
  listProjectsAction as listProjects,
  updateProjectAction as updateProject,
} from "./projects-part-1";
import {
  restoreProjectAction as restoreProject,
  saveProjectMilestonesAction as saveMilestones,
  setProjectPeopleAction as setProjectPeople,
} from "./projects-part-2";

export async function listProjectsAction(input: unknown) {
  return await listProjects(input);
}

export async function createProjectAction(input: unknown) {
  return await createProject(input);
}

export async function duplicateProjectAction(input: unknown) {
  return await duplicateProject(input);
}

export async function updateProjectAction(input: unknown) {
  return await updateProject(input);
}

export async function archiveProjectAction(input: unknown) {
  return await archiveProject(input);
}

export async function restoreProjectAction(input: unknown) {
  return await restoreProject(input);
}

export async function setProjectPeopleAction(input: unknown) {
  return await setProjectPeople(input);
}

export async function saveProjectMilestonesAction(input: unknown) {
  return await saveMilestones(input);
}

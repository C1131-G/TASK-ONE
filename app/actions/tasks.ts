"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  changeTaskColumnAction as changeColumn,
  createTaskAction as createTask,
  listProjectTasksAction as listTasks,
  updateTaskAction as updateTask,
} from "./tasks-part-1";
import {
  duplicateTaskAction as duplicateTask,
  moveTaskAction as moveTask,
  setTaskRecurrenceAction as setRecurrence,
} from "./tasks-part-2";
import {
  archiveTaskAction as archiveTask,
  restoreTaskAction as restoreTask,
  undoTaskArchiveAction as undoArchive,
  undoTaskCompletionAction as undoCompletion,
} from "./tasks-part-3";
import {
  bulkUpdateTasksAction as bulkUpdate,
  reorderTasksAction as reorderTasks,
  setTaskRelationsAction as setRelations,
} from "./tasks-part-4";

export async function listProjectTasksAction(input: unknown) {
  return await listTasks(input);
}

export async function createTaskAction(input: unknown) {
  return await createTask(input);
}

export async function updateTaskAction(input: unknown) {
  return await updateTask(input);
}

export async function changeTaskColumnAction(input: unknown) {
  return await changeColumn(input);
}

export async function setTaskRecurrenceAction(input: unknown) {
  return await setRecurrence(input);
}

export async function moveTaskAction(input: unknown) {
  return await moveTask(input);
}

export async function duplicateTaskAction(input: unknown) {
  return await duplicateTask(input);
}

export async function archiveTaskAction(input: unknown) {
  return await archiveTask(input);
}

export async function restoreTaskAction(input: unknown) {
  return await restoreTask(input);
}

export async function undoTaskArchiveAction(input: unknown) {
  return await undoArchive(input);
}

export async function undoTaskCompletionAction(input: unknown) {
  return await undoCompletion(input);
}

export async function bulkUpdateTasksAction(input: unknown) {
  return await bulkUpdate(input);
}

export async function setTaskRelationsAction(input: unknown) {
  return await setRelations(input);
}

export async function reorderTasksAction(input: unknown) {
  return await reorderTasks(input);
}

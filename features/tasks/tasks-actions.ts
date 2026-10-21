"use server";

/* eslint-disable func-style -- Next Server Actions require named declarations. */

import {
  archiveTaskAction as archiveTaskImpl,
  restoreTaskAction as restoreTaskImpl,
  undoTaskArchiveAction as undoTaskArchiveImpl,
  undoTaskCompletionAction as undoTaskCompletionImpl,
} from "./actions/tasks-archiving";
import {
  bulkUpdateTasksAction as bulkUpdateTasksImpl,
  reorderTasksAction as reorderTasksImpl,
  setTaskRelationsAction as setTaskRelationsImpl,
} from "./actions/tasks-bulk-and-relations";
import {
  createCommentAction as createCommentImpl,
  listTaskCommentsAction as listTaskCommentsImpl,
  removeCommentAction as removeCommentImpl,
  toggleCommentReactionAction as toggleCommentReactionImpl,
  undoCommentRemovalAction as undoCommentRemovalImpl,
} from "./actions/tasks-comments";
import {
  getTasksCsvExportAction as getTasksCsvExportImpl,
  importTasksCsvAction as importTasksCsvImpl,
} from "./actions/tasks-csv";
import {
  changeTaskColumnAction as changeTaskColumnImpl,
  createTaskAction as createTaskImpl,
  rescheduleTaskAction as rescheduleTaskImpl,
  updateTaskAction as updateTaskImpl,
} from "./actions/tasks-editing";
import {
  createLabelAction as createLabelImpl,
  removeLabelAction as removeLabelImpl,
  updateLabelAction as updateLabelImpl,
} from "./actions/tasks-labels";
import {
  duplicateTaskAction as duplicateTaskImpl,
  moveTaskAction as moveTaskImpl,
  setTaskRecurrenceAction as setTaskRecurrenceImpl,
} from "./actions/tasks-placement";
import {
  createSubtaskAction as createSubtaskImpl,
  listTaskSubtasksAction as listTaskSubtasksImpl,
  promoteSubtaskAction as promoteSubtaskImpl,
  removeSubtaskAction as removeSubtaskImpl,
  reorderSubtasksAction as reorderSubtasksImpl,
  updateSubtaskAction as updateSubtaskImpl,
} from "./actions/tasks-subtasks";
import { readTaskBundle } from "./task-details-panel-data";
import { getProjectTask, listLabels, listProjectTasks } from "./tasks-queries";

// Reads below are called from client components after the first render.

// The drawer's reads in one call: they run in parallel on the server instead
// of queueing as five separate action requests.
export async function getTaskBundleAction(
  projectId: string,
  taskId: string,
  bugId?: string
) {
  return await readTaskBundle(projectId, taskId, bugId);
}

export async function getProjectTaskAction(input: unknown) {
  return await getProjectTask(input);
}

export async function listLabelsAction(input: unknown) {
  return await listLabels(input);
}

export async function listProjectTasksAction(input: unknown) {
  return await listProjectTasks(input);
}

export async function getTasksCsvExportAction(input: unknown) {
  return await getTasksCsvExportImpl(input);
}

export async function importTasksCsvAction(input: unknown) {
  return await importTasksCsvImpl(input);
}

export async function createTaskAction(input: unknown) {
  return await createTaskImpl(input);
}

export async function updateTaskAction(input: unknown) {
  return await updateTaskImpl(input);
}

export async function changeTaskColumnAction(input: unknown) {
  return await changeTaskColumnImpl(input);
}

export async function rescheduleTaskAction(input: unknown) {
  return await rescheduleTaskImpl(input);
}

export async function setTaskRecurrenceAction(input: unknown) {
  return await setTaskRecurrenceImpl(input);
}

export async function moveTaskAction(input: unknown) {
  return await moveTaskImpl(input);
}

export async function duplicateTaskAction(input: unknown) {
  return await duplicateTaskImpl(input);
}

export async function archiveTaskAction(input: unknown) {
  return await archiveTaskImpl(input);
}

export async function restoreTaskAction(input: unknown) {
  return await restoreTaskImpl(input);
}

export async function undoTaskArchiveAction(input: unknown) {
  return await undoTaskArchiveImpl(input);
}

export async function undoTaskCompletionAction(input: unknown) {
  return await undoTaskCompletionImpl(input);
}

export async function bulkUpdateTasksAction(input: unknown) {
  return await bulkUpdateTasksImpl(input);
}

export async function setTaskRelationsAction(input: unknown) {
  return await setTaskRelationsImpl(input);
}

export async function reorderTasksAction(input: unknown) {
  return await reorderTasksImpl(input);
}

export async function createLabelAction(input: unknown) {
  return await createLabelImpl(input);
}

export async function updateLabelAction(input: unknown) {
  return await updateLabelImpl(input);
}

export async function removeLabelAction(input: unknown) {
  return await removeLabelImpl(input);
}

export async function listTaskSubtasksAction(input: unknown) {
  return await listTaskSubtasksImpl(input);
}

export async function createSubtaskAction(input: unknown) {
  return await createSubtaskImpl(input);
}

export async function reorderSubtasksAction(input: unknown) {
  return await reorderSubtasksImpl(input);
}

export async function updateSubtaskAction(input: unknown) {
  return await updateSubtaskImpl(input);
}

export async function removeSubtaskAction(input: unknown) {
  return await removeSubtaskImpl(input);
}

export async function promoteSubtaskAction(input: unknown) {
  return await promoteSubtaskImpl(input);
}

export async function listTaskCommentsAction(input: unknown) {
  return await listTaskCommentsImpl(input);
}

export async function createCommentAction(input: unknown) {
  return await createCommentImpl(input);
}

export async function removeCommentAction(input: unknown) {
  return await removeCommentImpl(input);
}

export async function undoCommentRemovalAction(input: unknown) {
  return await undoCommentRemovalImpl(input);
}

export async function toggleCommentReactionAction(input: unknown) {
  return await toggleCommentReactionImpl(input);
}

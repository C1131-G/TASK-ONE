import { Layer } from "effect";

import { WorkManagement } from "./work-contracts";
import { archiveTask, undoTaskArchive } from "./work-task-archive";
import { bulkUpdateTasks } from "./work-task-bulk";
import { setTaskClientVisibility } from "./work-task-client-visibility";
import { undoTaskCompletion, restoreTask } from "./work-task-completion";
import { createTask } from "./work-task-creation";
import { duplicateTask } from "./work-task-duplicate";
import { moveTask } from "./work-task-move";
import { changeTaskStatus, listProjectTasks } from "./work-task-queries";
import { setTaskRecurrence } from "./work-task-recurrence";
import { rescheduleTask } from "./work-task-reschedule";
import { updateTask } from "./work-task-update";

export {
  CreateTaskInputSchema,
  CreatedTaskSchema,
  ProjectTaskListItemSchema,
  TaskArchiveUndoReceiptSchema,
  TaskClientVisibilitySchema,
  TaskRecurrenceInputSchema,
  TaskVersionResultSchema,
  UpdateTaskInputSchema,
  WorkManagement,
} from "./work-contracts";
export type {
  BulkTaskChanges,
  BulkTaskTarget,
  CreateTaskInput,
  CreatedTask,
  ProjectTaskListItem,
  TaskArchiveUndoReceipt,
  TaskRecurrenceInput,
  UpdateTaskInput,
} from "./work-contracts";
export { allocateTaskNumber } from "./work-task-creation";

export const WorkManagementLive = Layer.succeed(
  WorkManagement,
  WorkManagement.of({
    archiveTask,
    bulkUpdateTasks,
    changeTaskStatus,
    createTask,
    duplicateTask,
    listProjectTasks,
    moveTask,
    rescheduleTask,
    restoreTask,
    setTaskClientVisibility,
    setTaskRecurrence,
    undoTaskArchive,
    undoTaskCompletion,
    updateTask,
  })
);

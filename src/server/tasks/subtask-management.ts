import { Layer } from "effect";

import { SubtaskManagement } from "./subtask-contracts";
import { createSubtask } from "./subtask-create-subtask";
import { listSubtasks } from "./subtask-list-subtasks";
import { promoteSubtask } from "./subtask-promote-subtask";
import { removeSubtask } from "./subtask-remove-subtask";
import { reorderSubtasks } from "./subtask-reorder-subtasks";
import { updateSubtask } from "./subtask-update-subtask";

export {
  CreatedSubtaskSchema,
  RemovedSubtaskSchema,
  ReorderedSubtasksSchema,
  SubtaskEntrySchema,
  SubtaskFieldsSchema,
  SubtaskManagement,
  UpdateSubtaskInputSchema,
} from "./subtask-contracts";
export type {
  CreatedSubtask,
  SubtaskEntry,
  SubtaskFields,
  UpdateSubtaskInput,
  UpdatedSubtask,
} from "./subtask-contracts";

export const SubtaskManagementLive = Layer.succeed(
  SubtaskManagement,
  SubtaskManagement.of({
    createSubtask,
    listSubtasks,
    promoteSubtask,
    removeSubtask,
    reorderSubtasks,
    updateSubtask,
  })
);

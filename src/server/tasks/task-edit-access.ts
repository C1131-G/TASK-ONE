import type { Transaction } from "../work/work-internal";
import { mayEditTask } from "./permissions";

// `mayEditTask` for code that holds a transaction and a task row: it loads the
// task's assignees only when the creator and role did not already settle it.
export const mayEditTaskRow = async (
  transaction: Transaction,
  editor: { readonly id: string; readonly role: string },
  task: { readonly id: string; readonly createdById: string }
): Promise<boolean> => {
  if (mayEditTask(editor, { assigneeIds: [], creatorId: task.createdById })) {
    return true;
  }
  const assignment = await transaction.orm.public.TaskAssignee.where({
    taskId: task.id,
    userId: editor.id,
  })
    .select("taskId")
    .first();
  return Boolean(assignment);
};

import { getBugHistoryAction } from "@/features/bugs/bugs-actions";
import { listTaskFilesAction } from "@/features/files/files-actions";
import {
  getProjectTaskAction,
  listTaskCommentsAction,
  listTaskSubtasksAction,
} from "@/features/tasks/tasks-actions";

export interface TaskFile {
  readonly id: string;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedById: string;
  readonly createdAt: string;
  readonly copyState: "pending" | "ready" | "failed";
}

export interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

export const readTaskBundle = async (
  projectId: string,
  taskId: string,
  bugId?: string
) => {
  const [task, comments, subtasks, files, bugHistory] = await Promise.all([
    getProjectTaskAction({ projectId, taskId }),
    listTaskCommentsAction({ taskId }),
    listTaskSubtasksAction({ taskId }),
    listTaskFilesAction({ taskId }),
    bugId ? getBugHistoryAction({ bugId }) : Promise.resolve(null),
  ]);
  return { bugHistory, comments, files, subtasks, task };
};

export type TaskBundle = Awaited<ReturnType<typeof readTaskBundle>>;

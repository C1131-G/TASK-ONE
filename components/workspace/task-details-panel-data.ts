import { listTaskCommentsAction } from "@/app/actions/comments";
import { listTaskSubtasksAction } from "@/app/actions/subtasks";
import { getProjectTaskAction } from "@/app/actions/tasks";
import { listTaskFilesAction } from "@/app/actions/uploads";

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

export const readTaskBundle = async (projectId: string, taskId: string) => {
  const [task, comments, subtasks, files] = await Promise.all([
    getProjectTaskAction({ projectId, taskId }),
    listTaskCommentsAction({ taskId }),
    listTaskSubtasksAction({ taskId }),
    listTaskFilesAction({ taskId }),
  ]);
  return { comments, files, subtasks, task };
};

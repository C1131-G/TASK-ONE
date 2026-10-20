import "server-only";
import { getBugHistory } from "@/features/bugs/bugs-queries";
import { listTaskFilesAction } from "@/features/files/actions/files-upload-requests";
import { listTaskCommentsAction } from "@/features/tasks/actions/tasks-comments";
import { listTaskSubtasksAction } from "@/features/tasks/actions/tasks-subtasks";
import { getProjectTask } from "@/features/tasks/tasks-queries";

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

// Every read the task panel shows, run together on the server.
export const readTaskBundle = async (
  projectId: string,
  taskId: string,
  bugId?: string
) => {
  const [task, comments, subtasks, files, bugHistory] = await Promise.all([
    getProjectTask({ projectId, taskId }),
    listTaskCommentsAction({ taskId }),
    listTaskSubtasksAction({ taskId }),
    listTaskFilesAction({ taskId }),
    bugId ? getBugHistory({ bugId }) : Promise.resolve(null),
  ]);
  return { bugHistory, comments, files, subtasks, task };
};

export type TaskBundle = Awaited<ReturnType<typeof readTaskBundle>>;

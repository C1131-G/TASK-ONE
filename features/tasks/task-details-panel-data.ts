import "server-only";
import { listTaskApprovals } from "@/features/approvals/approval-queries";
import { getBugHistory } from "@/features/bugs/bugs-queries";
import { listTaskFilesAction } from "@/features/files/actions/files-upload-requests";
import { getTaskLinkedPulls } from "@/features/github/github-queries";
import { listTaskCommentsAction } from "@/features/tasks/actions/tasks-comments";
import { listTaskSubtasksAction } from "@/features/tasks/actions/tasks-subtasks";
import { getProjectTask } from "@/features/tasks/tasks-queries";
import { getRunningTimer, getTaskTime } from "@/features/time/time-queries";

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
  const [
    task,
    comments,
    subtasks,
    files,
    bugHistory,
    time,
    timer,
    pulls,
    approvals,
  ] = await Promise.all([
    getProjectTask({ projectId, taskId }),
    listTaskCommentsAction({ taskId }),
    listTaskSubtasksAction({ taskId }),
    listTaskFilesAction({ taskId }),
    bugId ? getBugHistory({ bugId }) : Promise.resolve(null),
    getTaskTime({ taskId }),
    getRunningTimer({}),
    getTaskLinkedPulls({ taskId }),
    listTaskApprovals({ taskId }),
  ]);
  return {
    approvals,
    bugHistory,
    comments,
    files,
    pulls,
    subtasks,
    task,
    time,
    timer,
  };
};

export type TaskBundle = Awaited<ReturnType<typeof readTaskBundle>>;

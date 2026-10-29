import { Effect } from "effect";
import { useLocalSearchParams } from "expo-router";

import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { SkelterTaskDetailScreen, type TaskDetailModel } from "@/features/tasks/task-screens";
import { getTaskContext, type MobileTaskContext } from "@/features/tasks/queries";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";

const toTaskDetailModel = (detail: MobileTaskContext | null): TaskDetailModel =>
  detail === null
    ? {
        projectName: "Project name",
        status: "todo",
        subtasks: [
          { completed: false, id: "skeleton-subtask-1", title: "Subtask title" },
          { completed: false, id: "skeleton-subtask-2", title: "Subtask title" },
        ],
        title: "Task title",
        version: 0,
      }
    : {
        projectName: detail.projectName,
        status: detail.status,
        subtasks: detail.subtasks.map((subtask) => ({
          completed: subtask.completed,
          id: subtask.id,
          title: subtask.title,
        })),
        title: detail.title,
        version: detail.version,
      };

export default function TaskDetailRoute() {
  const api = useApi();
  const keys = useKeys();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  const program: Effect.Effect<MobileTaskContext | null, AppFailure> =
    api === null || id.length === 0 ? Effect.succeed(null) : getTaskContext(api, id);

  const task = useApiQuery({
    enabled: api !== null && id.length > 0,
    program,
    queryKey: ["tasks", id, "detail"],
  });

  if (api === null || keys === null || id.length === 0) {
    return <WorkspaceEmptyState message="This task link is incomplete." title="No task" />;
  }
  if (task.error !== null) {
    return <WorkspaceErrorState failure={task.error} onRetry={() => void task.refetch()} />;
  }

  const detail = task.data ?? null;
  if (!task.isPending && detail === null) {
    return <WorkspaceEmptyState message="This task no longer exists." title="No task" />;
  }

  return (
    <SkelterTaskDetailScreen
      api={api}
      hasSkeleton
      isLoading={task.isPending}
      keys={keys}
      task={toTaskDetailModel(detail)}
      taskId={id}
    />
  );
}

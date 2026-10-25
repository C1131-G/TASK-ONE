import { Effect } from "effect";
import { useLocalSearchParams } from "expo-router";

import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { TaskDetailScreen } from "@/features/tasks/task-screens";
import { getTask, type TaskDetail } from "@/features/tasks/queries";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";

export default function TaskDetailRoute() {
  const api = useApi();
  const keys = useKeys();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  const program: Effect.Effect<TaskDetail | null, AppFailure> =
    api === null || id.length === 0 ? Effect.succeed(null) : getTask(api, id);

  const task = useApiQuery({
    enabled: api !== null && id.length > 0,
    program,
    queryKey: ["tasks", id, "detail"],
  });

  if (api === null || keys === null || id.length === 0) {
    return <WorkspaceEmptyState message="This task link is incomplete." title="No task" />;
  }
  if (task.isPending) {
    return <WorkspaceSkeleton variant="panel" />;
  }
  if (task.error !== null) {
    return <WorkspaceErrorState failure={task.error} onRetry={() => void task.refetch()} />;
  }

  const detail = task.data ?? null;
  if (detail === null) {
    return <WorkspaceEmptyState message="This task no longer exists." title="No task" />;
  }

  return (
    <TaskDetailScreen
      api={api}
      keys={keys}
      task={{
        projectName: detail.projectName,
        status: detail.status,
        title: detail.title,
        version: detail.version,
      }}
      taskId={id}
    />
  );
}

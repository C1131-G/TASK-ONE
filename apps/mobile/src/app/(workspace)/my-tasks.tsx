import { Effect } from "effect";
import { useRouter } from "expo-router";

import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { SkelterMyTasksScreen, type TaskRowModel } from "@/features/tasks/task-screens";
import { getMyWork } from "@/features/tasks/queries";
import { useApi, useApiQuery } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";

interface PageModel {
  readonly tasks: readonly TaskRowModel[];
}

export default function MyTasksRoute() {
  const api = useApi();
  const router = useRouter();

  const program: Effect.Effect<PageModel, AppFailure> =
    api === null
      ? Effect.succeed<PageModel>({ tasks: [] })
      : Effect.map(getMyWork(api), (work) => ({
          tasks: work.items.map((item) => ({
            dueAt: item.dueDate,
            id: item.id,
            priority: item.priority,
            projectName: item.projectName,
            status: item.status,
            title: item.title,
          })),
        }));

  const tasks = useApiQuery({
    enabled: api !== null,
    program,
    queryKey: ["tasks", "mine"],
  });

  if (api === null) {
    return <WorkspaceSkeleton variant="panel" />;
  }
  if (tasks.error !== null) {
    return <WorkspaceErrorState failure={tasks.error} onRetry={() => void tasks.refetch()} />;
  }

  const skeletonTasks = [
    { dueAt: null, id: "skeleton-1", priority: "medium", projectName: "Project", status: "todo", title: "Task title" },
    { dueAt: null, id: "skeleton-2", priority: "medium", projectName: "Project", status: "todo", title: "Task title" },
    { dueAt: null, id: "skeleton-3", priority: "medium", projectName: "Project", status: "todo", title: "Task title" },
  ] satisfies readonly TaskRowModel[];

  return (
    <WorkspaceTabShell>
      <SkelterMyTasksScreen
        hasSkeleton
        isLoading={tasks.isPending}
        onOpenTask={(id) => router.push(`/tasks/${id}`)}
        tasks={tasks.data?.tasks ?? skeletonTasks}
      />
    </WorkspaceTabShell>
  );
}

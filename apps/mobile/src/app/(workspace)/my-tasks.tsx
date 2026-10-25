import { Effect } from "effect";
import { useRouter } from "expo-router";

import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { MyTasksScreen, type TaskRowModel } from "@/features/tasks/task-screens";
import { listTasks } from "@/features/tasks/queries";
import { useApi, useApiQuery } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";

interface PageModel {
  readonly tasks: readonly TaskRowModel[];
}

const toRows = (page: { readonly tasks: readonly TaskRowModel[] }): PageModel => ({
  tasks: page.tasks.map((task) => ({ ...task })),
});

export default function MyTasksRoute() {
  const api = useApi();
  const router = useRouter();

  const program: Effect.Effect<PageModel, AppFailure> =
    api === null
      ? Effect.succeed<PageModel>({ tasks: [] })
      : Effect.map(listTasks(api), (page) => toRows(page));

  const tasks = useApiQuery({
    enabled: api !== null,
    program,
    queryKey: ["tasks", "mine"],
  });

  if (api === null || tasks.isPending) {
    return <WorkspaceSkeleton variant="panel" />;
  }
  if (tasks.error !== null) {
    return <WorkspaceErrorState failure={tasks.error} onRetry={() => void tasks.refetch()} />;
  }

  return (
    <WorkspaceTabShell>
      <MyTasksScreen
        onOpenTask={(id) => router.push(`/tasks/${id}`)}
        tasks={tasks.data?.tasks ?? []}
      />
    </WorkspaceTabShell>
  );
}

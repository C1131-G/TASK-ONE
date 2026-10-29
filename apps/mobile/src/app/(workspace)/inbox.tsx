import { Effect } from "effect";
import { useRouter } from "expo-router";

import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { SkelterInboxScreen } from "@/features/inbox/inbox-screen";
import { listInbox, type InboxItem } from "@/features/inbox/queries";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";
import type { InboxPage } from "@/features/inbox/queries";

export default function InboxRoute() {
  const api = useApi();
  const keys = useKeys();
  const router = useRouter();

  const program: Effect.Effect<InboxPage, AppFailure> =
    api === null ? Effect.succeed({ items: [], nextCursor: null, unreadCount: 0, unreadInboxCount: 0 }) : listInbox(api);

  const inbox = useApiQuery({ enabled: api !== null, program, queryKey: ["inbox"] });

  if (api === null || keys === null) {
    return <WorkspaceSkeleton variant="panel" />;
  }
  if (inbox.error !== null) {
    return <WorkspaceErrorState failure={inbox.error} onRetry={() => void inbox.refetch()} />;
  }

  const skeletonItems: readonly InboxItem[] = [
    {
      actorId: null,
      actorName: null,
      createdAt: "",
      id: "skeleton-inbox-1",
      projectId: null,
      projectName: "Project name",
      readAt: null,
      snippet: null,
      taskId: null,
      text: "New task assigned",
      type: "task_assigned",
    },
    {
      actorId: null,
      actorName: null,
      createdAt: "",
      id: "skeleton-inbox-2",
      projectId: null,
      projectName: "Project name",
      readAt: null,
      snippet: null,
      taskId: null,
      text: "Task status changed",
      type: "task_updated",
    },
  ];

  return (
    <WorkspaceTabShell>
      <SkelterInboxScreen
        api={api}
        hasSkeleton
        isLoading={inbox.isPending}
        items={inbox.data?.items ?? skeletonItems}
        keys={keys}
        onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
      />
    </WorkspaceTabShell>
  );
}

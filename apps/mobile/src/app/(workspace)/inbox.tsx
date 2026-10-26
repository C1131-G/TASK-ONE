import { Effect } from "effect";
import { useRouter } from "expo-router";

import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { InboxScreen } from "@/features/inbox/inbox-screen";
import { listInbox } from "@/features/inbox/queries";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";
import type { InboxPage } from "@/features/inbox/queries";

export default function InboxRoute() {
  const api = useApi();
  const keys = useKeys();
  const router = useRouter();

  const program: Effect.Effect<InboxPage, AppFailure> =
    api === null ? Effect.succeed({ items: [], unread: 0 }) : listInbox(api);

  const inbox = useApiQuery({ enabled: api !== null, program, queryKey: ["inbox"] });

  if (api === null || keys === null || inbox.isPending) {
    return <WorkspaceSkeleton variant="panel" />;
  }
  if (inbox.error !== null) {
    return <WorkspaceErrorState failure={inbox.error} onRetry={() => void inbox.refetch()} />;
  }

  return (
    <WorkspaceTabShell>
      <InboxScreen
        api={api}
        items={inbox.data?.items ?? []}
        keys={keys}
        onOpenTask={(taskId) => router.push(`/tasks/${taskId}`)}
      />
    </WorkspaceTabShell>
  );
}

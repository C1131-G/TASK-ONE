import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { HomeScreen } from "@/features/workspace/workspace-screens";
import { useSessionState } from "@/features/auth/session-gate";
import { useApi } from "@/runtime/api-hooks";

export default function HomeRoute() {
  const api = useApi();
  const { state } = useSessionState();

  if (api === null || state.kind !== "authenticated") {
    return <WorkspaceSkeleton variant="panel" />;
  }

  return <HomeScreen api={api} name={state.me.name} />;
}

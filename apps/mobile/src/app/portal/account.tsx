import { Effect } from "effect";
import { useRouter } from "expo-router";

import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { useSessionState, useGateSession } from "@/features/auth/session-gate";
import { PortalAccountBody } from "@/features/portal/portal-list";

export default function Route() {
  const session = useGateSession();
  const router = useRouter();
  const { state } = useSessionState();
  const me = state.kind === "authenticated" ? state.me : null;

  return (
    <WorkspaceScreen title="Account">
      {me === null ? null : (
        <PortalAccountBody
          email={me.id}
          name={me.name}
          onOpenNotifications={() => router.push("/portal/notification-settings")}
          onSignOut={() => {
            if (session !== null) {
              void Effect.runPromiseExit(session.signOut);
            }
            router.push("/login");
          }}
        />
      )}
    </WorkspaceScreen>
  );
}

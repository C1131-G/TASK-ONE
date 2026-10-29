import { useRouter } from "expo-router";

import { SettingsScreen } from "@/features/workspace/workspace-screens";
import { useGateSession } from "@/features/auth/session-gate";
import { Effect } from "effect";

export default function SettingsRoute() {
  const session = useGateSession();
  const router = useRouter();

  return (
    <SettingsScreen
      onOpenNotifications={() => router.push("/notification-settings")}
      onSignOut={() => {
        if (session !== null) {
          void Effect.runPromiseExit(session.signOut);
        }
        router.push("/login");
      }}
    />
  );
}

import { Redirect, Stack } from "expo-router";

import { routeFor } from "@/features/auth/route-for";
import { useSessionState } from "@/features/auth/session-gate";

/** The staff area; clients go to the portal, signed-out users to sign-in. */
export default function WorkspaceLayout() {
  const { restored, state } = useSessionState();
  const area = routeFor(state);

  if (!restored) {
    return null;
  }
  if (area !== "workspace") {
    return <Redirect href={area === "portal" ? "/portal" : "/login"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

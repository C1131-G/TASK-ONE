import { Redirect, Stack } from "expo-router";

import { routeFor } from "@/features/auth/route-for";
import { useSessionState } from "@/features/auth/session-gate";

/** The client area; staff go to the workspace, signed-out users to sign-in. */
export default function PortalLayout() {
  const { restored, state } = useSessionState();
  const area = routeFor(state);

  if (!restored) {
    return null;
  }
  if (area !== "portal") {
    return <Redirect href={area === "workspace" ? "/" : "/login"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

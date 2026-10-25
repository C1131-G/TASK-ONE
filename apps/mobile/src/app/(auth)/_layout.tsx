import { Redirect, Stack } from "expo-router";

import { routeFor } from "@/features/auth/route-for";
import { useSessionState } from "@/features/auth/session-gate";

/** The sign-in group; authenticated users bounce to their area. */
export default function AuthLayout() {
  const { restored, state } = useSessionState();
  const area = routeFor(state);

  if (!restored) {
    return null;
  }
  if (area !== "login" && area !== "change-password") {
    return <Redirect href={area === "portal" ? "/portal" : "/"} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

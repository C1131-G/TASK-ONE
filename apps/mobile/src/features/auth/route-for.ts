import type { SessionState } from "@/services/session";

export type RouteArea = "login" | "change-password" | "workspace" | "portal";

/** Decides where the user belongs from the session state alone. */
export const routeFor = (state: SessionState): RouteArea => {
  if (state.kind === "anonymous") {
    return "login";
  }
  if (state.me.mustChangePassword) {
    return "change-password";
  }
  return state.me.role === "client" ? "portal" : "workspace";
};

export const AREA_HREFS: Record<RouteArea, `/${string}`> = {
  "change-password": "/change-password",
  login: "/login",
  portal: "/portal",
  workspace: "/",
};

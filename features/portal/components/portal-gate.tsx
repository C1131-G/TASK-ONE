import type { Route } from "next";
import { redirect } from "next/navigation";

import { getPageSession } from "@/src/server/auth/page-session";

const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";
const WORKSPACE_PATH: Route = "/";

// Sends anyone who is not a signed-in client to their own home. It renders
// nothing; portal data still checks access in its own queries.
const PortalAccessGate = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(LOGIN_PATH);
  }
  if (session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  if (session.user.role !== "client") {
    redirect(WORKSPACE_PATH);
  }
  return null;
};

export { PortalAccessGate };

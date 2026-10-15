import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getPageSession } from "@/src/server/auth/page-session";
import { PORTAL_PREVIEW_COOKIE } from "@/src/server/auth/session";

const LOGIN_PATH: Route = "/login";
const CHANGE_PASSWORD_PATH: Route = "/change-password";
const INACTIVITY_LOGIN_PATH = "/login?reason=inactivity" as Route;
const WORKSPACE_PATH: Route = "/";

// Sends anyone who is not a signed-in client to their own home. It renders
// nothing; portal data still checks access in its own queries.
const PortalAccessGate = async () => {
  const session = await getPageSession();
  if (session.kind === "anonymous") {
    redirect(
      session.reason === "inactivity" ? INACTIVITY_LOGIN_PATH : LOGIN_PATH
    );
  }
  if (session.user.mustChangePassword) {
    redirect(CHANGE_PASSWORD_PATH);
  }
  if (session.user.role === "admin") {
    // An admin may enter only while a "View as client" preview is active.
    const jar = await cookies();
    if (jar.has(PORTAL_PREVIEW_COOKIE)) {
      return null;
    }
  }
  if (session.user.role !== "client") {
    redirect(WORKSPACE_PATH);
  }
  return null;
};

export { PortalAccessGate };

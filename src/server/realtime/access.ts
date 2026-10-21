import type { RealtimeEvent } from "./events";

export interface RealtimeViewer {
  readonly id: string;
  readonly role: "admin" | "employee" | "client";
  readonly clientCompanyId: string | null;
}

export interface AccessLookups {
  // The user exists, is not deactivated and may use the app.
  readonly isActive: (userId: string) => Promise<boolean>;
  // The task is a bug reported by the client's company.
  readonly clientCanSeeTask: (
    companyId: string,
    taskId: string
  ) => Promise<boolean>;
}

const clientMayReceive = (
  viewer: RealtimeViewer,
  event: RealtimeEvent,
  lookups: AccessLookups
): Promise<boolean> => {
  const { clientCompanyId } = viewer;
  if (!clientCompanyId) {
    return Promise.resolve(false);
  }
  if (event.kind === "task") {
    return lookups.clientCanSeeTask(clientCompanyId, event.taskId);
  }
  if (event.kind === "comment" && event.visibility === "public") {
    return lookups.clientCanSeeTask(clientCompanyId, event.taskId);
  }
  return Promise.resolve(false);
};

// Decides, for one viewer, whether an event may be sent. It runs before every
// delivery and so also covers a user who was deactivated or lost access after
// the stream opened. Workspace members read every project and task; clients
// only see their own company's bugs and the public side of them.
export const canViewerReceive = async (
  viewer: RealtimeViewer,
  event: RealtimeEvent,
  lookups: AccessLookups
): Promise<boolean> => {
  if (event.kind === "inbox" && event.userId !== viewer.id) {
    return false;
  }
  if (!(await lookups.isActive(viewer.id))) {
    return false;
  }
  if (event.kind === "inbox") {
    return true;
  }
  return viewer.role === "client"
    ? clientMayReceive(viewer, event, lookups)
    : true;
};

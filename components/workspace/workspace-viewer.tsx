"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";

export interface WorkspaceProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

export interface WorkspaceViewer {
  readonly name: string;
  readonly role: "admin" | "employee";
  readonly projects: readonly WorkspaceProject[];
  readonly unreadInboxCount: number;
  readonly unreadNotificationCount: number;
}

// The shell's server half starts this read without awaiting it, so pages render
// while only the chrome that shows the viewer's data waits behind small boundaries.
const WorkspaceViewerContext = createContext<Promise<WorkspaceViewer> | null>(
  null
);

export const WorkspaceViewerProvider = ({
  children,
  viewer,
}: {
  readonly children: ReactNode;
  readonly viewer: Promise<WorkspaceViewer>;
}) => (
  <WorkspaceViewerContext value={viewer}>{children}</WorkspaceViewerContext>
);

export const useWorkspaceViewer = (): WorkspaceViewer => {
  const viewer = use(WorkspaceViewerContext);
  if (!viewer) {
    throw new Error("useWorkspaceViewer must be used inside WorkspaceShell.");
  }
  return use(viewer);
};

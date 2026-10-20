/* eslint-disable shadcn/no-unknown-classes */

import type { ReactNode } from "react";
import { Suspense } from "react";

import { WorkspaceRevealGate } from "@/components/workspace/workspace-reveal-gate";
import {
  WorkspaceBottomChrome,
  WorkspaceBottomChromeFallback,
  WorkspaceSidebar,
  WorkspaceSidebarFallback,
  WorkspaceTopbarActions,
  WorkspaceTopbarActionsFallback,
  WorkspaceTopbarMenu,
  WorkspaceTopbarMenuFallback,
  WorkspaceTopbarTitle,
  WorkspaceTopbarTitleFallback,
} from "@/components/workspace/workspace-shell-sections";
import { WorkspaceUndoProvider } from "@/components/workspace/workspace-undo";
import { PushNotificationsControl } from "@/features/notifications/components/push-notifications-control";

export interface WorkspaceProject {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly icon: string;
}

// The request-specific data the shell chrome needs; null while signed out.
export interface WorkspaceFrameData {
  readonly name: string;
  readonly role: "admin" | "employee";
  readonly projects: readonly WorkspaceProject[];
  readonly unreadInboxCount: number;
  readonly unreadNotificationCount: number;
}

// The frame markup and page slot are static. The top bar title reads only the
// URL; the navigation, top bar actions and bottom bar wait for the session
// data, each behind its own boundary. Each page owns its view transition: a
// layout-level one never mounts or unmounts, so enter and exit never fire.
export const WorkspaceShell = ({
  children,
  framePromise,
  publicKey,
}: {
  readonly children: ReactNode;
  readonly framePromise: Promise<WorkspaceFrameData | null>;
  readonly publicKey: string;
}) => (
  <div className="workspace-app">
    <WorkspaceUndoProvider>
      <a className="skip" href="#main-content">
        Skip to content
      </a>
      <div className="shell">
        <nav aria-label="Main" className="side">
          <Suspense fallback={<WorkspaceSidebarFallback />}>
            <WorkspaceSidebar framePromise={framePromise} />
          </Suspense>
        </nav>
        <main className="main">
          <header className="topbar">
            <Suspense fallback={<WorkspaceTopbarMenuFallback />}>
              <WorkspaceTopbarMenu framePromise={framePromise} />
            </Suspense>
            <span className="crumbs">
              <Suspense fallback={<WorkspaceTopbarTitleFallback />}>
                <WorkspaceTopbarTitle framePromise={framePromise} />
              </Suspense>
            </span>
            <span className="sp" />
            <Suspense fallback={<WorkspaceTopbarActionsFallback />}>
              <WorkspaceTopbarActions framePromise={framePromise} />
            </Suspense>
          </header>
          <div className="content" id="main-content" tabIndex={-1}>
            {children}
          </div>
        </main>
        <Suspense fallback={<WorkspaceBottomChromeFallback />}>
          <WorkspaceBottomChrome framePromise={framePromise} />
        </Suspense>
      </div>
      <PushNotificationsControl publicKey={publicKey} />
      <WorkspaceRevealGate />
    </WorkspaceUndoProvider>
  </div>
);

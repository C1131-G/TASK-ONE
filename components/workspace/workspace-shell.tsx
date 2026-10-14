/* eslint-disable shadcn/no-unknown-classes */

import type { ReactNode } from "react";
import { Suspense, ViewTransition } from "react";

import {
  WorkspaceBottomChrome,
  WorkspaceSidebar,
  WorkspaceSidebarFallback,
  WorkspaceTopbar,
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

// The frame markup and page slot are static. Only the navigation, top bar and
// bottom bar wait for the session data, each behind its own boundary.
export const WorkspaceShell = ({
  children,
  frame,
  publicKey,
}: {
  readonly children: ReactNode;
  readonly frame: Promise<WorkspaceFrameData | null>;
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
            <WorkspaceSidebar frame={frame} />
          </Suspense>
        </nav>
        <main className="main">
          <header className="topbar">
            <Suspense fallback={<span className="sp" />}>
              <WorkspaceTopbar frame={frame} />
            </Suspense>
          </header>
          <div className="content" id="main-content" tabIndex={-1}>
            <ViewTransition
              default="none"
              enter={{
                default: "none",
                "nav-back": "nav-back",
                "nav-forward": "nav-forward",
              }}
              exit={{
                default: "none",
                "nav-back": "nav-back",
                "nav-forward": "nav-forward",
              }}
            >
              {children}
            </ViewTransition>
          </div>
        </main>
        <Suspense fallback={null}>
          <WorkspaceBottomChrome frame={frame} />
        </Suspense>
      </div>
      <PushNotificationsControl publicKey={publicKey} />
    </WorkspaceUndoProvider>
  </div>
);

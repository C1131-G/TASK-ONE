"use client";

import {
  useEffect,
  useEffectEvent,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  createShortcutMatcher,
  isPaletteToggle,
  readModalState,
} from "@/components/workspace/workspace-commands";
import type {
  Viewer,
  WorkspaceCommand,
} from "@/components/workspace/workspace-commands";

const OPEN_DIALOGS =
  '[role="dialog"][data-state="open"],[role="alertdialog"][data-state="open"]';
const MAC_PLATFORM = /mac|iphone|ipad|ipod/iu;

// Reads the open task drawer, which the shortcuts act on, from the page.
const readTaskDrawer = (): Viewer["taskDrawer"] => {
  const drawer = document.querySelector<HTMLElement>("[data-task-drawer]");
  if (!drawer) {
    return "none";
  }
  return drawer.dataset.taskEditable === undefined ? "readonly" : "editable";
};

// Platform is only known in the browser, so the server render shows Ctrl.
const ignoreUnsubscribe = (): void => undefined;
const subscribeToPlatform = () => ignoreUnsubscribe;
const getIsMac = () => MAC_PLATFORM.test(navigator.platform);
const getServerIsMac = () => false;
export const useIsMac = (): boolean =>
  useSyncExternalStore(subscribeToPlatform, getIsMac, getServerIsMac);

// Reads what the viewer can do right now: the page decides which task, if any, is open.
export const readViewer = (base: Omit<Viewer, "taskDrawer">): Viewer => ({
  ...base,
  taskDrawer: readTaskDrawer(),
});

export const useWorkspaceShortcuts = ({
  base,
  isMac,
  onRun,
  onTogglePalette,
}: {
  readonly base: Omit<Viewer, "taskDrawer">;
  readonly isMac: boolean;
  readonly onRun: (command: WorkspaceCommand) => void;
  readonly onTogglePalette: () => void;
}) => {
  const matcher = useMemo(() => createShortcutMatcher(), []);
  const handleKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (isPaletteToggle(event, isMac)) {
      event.preventDefault();
      onTogglePalette();
      return;
    }
    if (event.defaultPrevented) {
      return;
    }
    const target = event.target instanceof HTMLElement ? event.target : null;
    const command = matcher.handle(
      {
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
        isComposing: event.isComposing,
        key: event.key,
        metaKey: event.metaKey,
        repeat: event.repeat,
        shiftKey: event.shiftKey,
        target,
      },
      {
        modal: readModalState([
          ...document.querySelectorAll<HTMLElement>(OPEN_DIALOGS),
        ]),
        viewer: readViewer(base),
      },
      event.timeStamp
    );
    if (command) {
      event.preventDefault();
      onRun(command);
    }
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleKeyDown(event);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
};

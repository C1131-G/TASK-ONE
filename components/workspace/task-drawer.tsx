"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { TaskDetailsPanel } from "@/components/workspace/task-details-panel";

interface DrawerTask {
  readonly id: string;
  readonly title: string;
  readonly version: number;
}

interface EmployeeOption {
  readonly id: string;
  readonly name: string;
}

interface TaskDrawerValue {
  readonly openTask: (taskId: string) => void;
}

const TaskDrawerContext = createContext<TaskDrawerValue | null>(null);

// Null outside a drawer host, so a row can fall back to its own panel.
export const useTaskDrawer = (): TaskDrawerValue | null =>
  useContext(TaskDrawerContext);

// Mirrors the open task into ?task=<id> without a server round trip. The server
// reads the same param on load, so a reload or a shared link reopens the task.
// Other params, such as the view, are kept.
const writeTaskParam = (taskId: string | null) => {
  const url = new URL(window.location.href);
  if (taskId) {
    url.searchParams.set("task", taskId);
  } else {
    url.searchParams.delete("task");
  }
  const next = `${url.pathname}${url.search}${url.hash}`;
  if (
    next !==
    `${window.location.pathname}${window.location.search}${window.location.hash}`
  ) {
    window.history.replaceState(window.history.state, "", next);
  }
};

// One drawer per page. The task list comes from the server page, so the drawer
// can open any task on the page, including from a deep link.
export const TaskDrawerProvider = ({
  children,
  currentUserId,
  editableTaskIds,
  employees,
  initialTaskId,
  isAdmin,
  projectId,
  tasks,
}: {
  readonly children: ReactNode;
  readonly currentUserId: string | null;
  readonly editableTaskIds: readonly string[];
  readonly employees: readonly EmployeeOption[];
  // The ?task= value the server saw, so a deep link renders on the first response.
  readonly initialTaskId: string | null;
  readonly isAdmin: boolean;
  readonly projectId: string;
  readonly tasks: readonly DrawerTask[];
}) => {
  // Kept in state rather than read from useSearchParams, which does not follow
  // history.replaceState. Back and forward are handled by popstate.
  const [selectedId, setSelectedId] = useState<string | null>(initialTaskId);
  const selected = tasks.find((task) => task.id === selectedId) ?? null;
  const [versionOverride, setVersionOverride] = useState<{
    readonly sourceVersion: number;
    readonly taskId: string;
    readonly value: number;
  } | null>(null);
  const value = useMemo<TaskDrawerValue>(
    () => ({
      openTask: (taskId) => {
        setSelectedId(taskId);
        writeTaskParam(taskId);
      },
    }),
    []
  );

  useEffect(() => {
    const syncFromUrl = () =>
      setSelectedId(new URLSearchParams(window.location.search).get("task"));
    window.addEventListener("popstate", syncFromUrl);
    return () => window.removeEventListener("popstate", syncFromUrl);
  }, []);

  // A server refresh after a save rewrites the URL without our param, so the
  // open task is written back whenever the page's task list is re-rendered.
  // The selected task object is replaced whenever the list re-renders.
  useEffect(() => {
    writeTaskParam(selected?.id ?? null);
  }, [selected]);
  const editable = selected ? editableTaskIds.includes(selected.id) : false;
  const version =
    selected &&
    versionOverride?.taskId === selected.id &&
    versionOverride.sourceVersion === selected.version
      ? versionOverride.value
      : (selected?.version ?? 0);

  return (
    <TaskDrawerContext.Provider value={value}>
      {children}
      {selected ? (
        <TaskDetailsPanel
          currentUserId={currentUserId}
          editable={editable}
          employees={employees}
          isAdmin={isAdmin}
          key={selected.id}
          onOpenChange={(next) => {
            if (!next) {
              setSelectedId(null);
              writeTaskParam(null);
            }
          }}
          onVersionChange={(nextVersion) =>
            setVersionOverride({
              sourceVersion: selected.version,
              taskId: selected.id,
              value: nextVersion,
            })
          }
          open
          projectId={projectId}
          taskId={selected.id}
          taskTitle={selected.title}
          version={version}
        />
      ) : null}
    </TaskDrawerContext.Provider>
  );
};

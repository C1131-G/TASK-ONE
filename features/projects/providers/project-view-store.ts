import type { Store, StoreActionsFactory } from "@tanstack/store";
import { createStore } from "@tanstack/store";

import type { TaskTableColumnId } from "../../tasks/task-table-columns";
import { clampColumnWidth } from "../../tasks/task-table-columns";
import type { ProjectViewSearch } from "../project-view-search";

// Client UI state for one project page. Server data (tasks, members, labels)
// stays in Server Components; this store only holds how the user is viewing it.
export const MAX_BULK_SELECTION = 100;

export interface ProjectViewState {
  readonly announcement: string;
  readonly search: ProjectViewSearch;
  readonly columnWidths: Partial<Record<TaskTableColumnId, number>>;
  readonly selectedTaskIds: readonly string[];
}

type ProjectViewStoreSetState = Store<ProjectViewState>["setState"];

export const projectViewActions = ({
  setState,
}: {
  readonly setState: ProjectViewStoreSetState;
}) => ({
  clearSelection: () =>
    setState((previous) => ({ ...previous, selectedTaskIds: [] })),
  replaceSearch: (search: ProjectViewSearch) =>
    setState((previous) => ({ ...previous, search })),
  // Lives here, not in the board, so it survives the refresh after a reorder.
  setAnnouncement: (announcement: string) =>
    setState((previous) => ({ ...previous, announcement })),
  setColumnWidth: (columnId: TaskTableColumnId, width: number) =>
    setState((previous) => ({
      ...previous,
      columnWidths: {
        ...previous.columnWidths,
        [columnId]: clampColumnWidth(columnId, width),
      },
    })),
  setSearch: (patch: Partial<ProjectViewSearch>) =>
    setState((previous) => ({
      ...previous,
      search: { ...previous.search, ...patch },
    })),
  // Selection is capped at the backend's 100-task transaction limit.
  setSelectedTaskIds: (taskIds: readonly string[]) =>
    setState((previous) => ({
      ...previous,
      selectedTaskIds: [...new Set(taskIds)].slice(0, MAX_BULK_SELECTION),
    })),
  toggleTaskSelected: (taskId: string, selected: boolean) =>
    setState((previous) => {
      const others = previous.selectedTaskIds.filter((id) => id !== taskId);
      if (!selected) {
        return { ...previous, selectedTaskIds: others };
      }
      return {
        ...previous,
        selectedTaskIds:
          others.length < MAX_BULK_SELECTION
            ? [...others, taskId]
            : previous.selectedTaskIds,
      };
    }),
});

export type ProjectViewActions = ReturnType<typeof projectViewActions>;

export const createInitialProjectViewState = (
  search: ProjectViewSearch,
  columnWidths: ProjectViewState["columnWidths"] = {}
): ProjectViewState => ({
  announcement: "",
  columnWidths,
  search,
  selectedTaskIds: [],
});

export const createProjectViewStore = (
  search: ProjectViewSearch,
  columnWidths: ProjectViewState["columnWidths"] = {}
) =>
  createStore<ProjectViewState, ProjectViewActions>(
    createInitialProjectViewState(search, columnWidths),
    projectViewActions as StoreActionsFactory<
      ProjectViewState,
      ProjectViewActions
    >
  );

export type ProjectViewStore = ReturnType<typeof createProjectViewStore>;

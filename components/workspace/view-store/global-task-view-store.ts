import type { Store, StoreActionsFactory } from "@tanstack/store";
import { createStore } from "@tanstack/store";

import type { GlobalTaskSearch } from "../global-task-view-state";
import type { TaskTableColumnId } from "../task-table-columns";
import { clampColumnWidth } from "../task-table-columns";
import { MAX_BULK_SELECTION } from "./project-view-store";

// Client state for the workspace task pages. Filtering runs on the loaded rows,
// so a filter change never waits on the server; the URL mirrors this store.
export interface GlobalTaskViewState {
  readonly columnWidths: Partial<Record<TaskTableColumnId, number>>;
  readonly search: GlobalTaskSearch;
  readonly selectedTaskIds: readonly string[];
}

type GlobalTaskStoreSetState = Store<GlobalTaskViewState>["setState"];

export const globalTaskViewActions = ({
  setState,
}: {
  readonly setState: GlobalTaskStoreSetState;
}) => ({
  clearSelection: () =>
    setState((previous) => ({ ...previous, selectedTaskIds: [] })),
  replaceSearch: (search: GlobalTaskSearch) =>
    setState((previous) => ({ ...previous, search })),
  setColumnWidth: (columnId: TaskTableColumnId, width: number) =>
    setState((previous) => ({
      ...previous,
      columnWidths: {
        ...previous.columnWidths,
        [columnId]: clampColumnWidth(columnId, width),
      },
    })),
  setSearch: (patch: Partial<GlobalTaskSearch>) =>
    setState((previous) => ({
      ...previous,
      search: { ...previous.search, ...patch },
    })),
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

export type GlobalTaskViewActions = ReturnType<typeof globalTaskViewActions>;

export const createInitialGlobalTaskViewState = (
  search: GlobalTaskSearch,
  columnWidths: GlobalTaskViewState["columnWidths"] = {}
): GlobalTaskViewState => ({
  columnWidths,
  search,
  selectedTaskIds: [],
});

export const createGlobalTaskViewStore = (
  search: GlobalTaskSearch,
  columnWidths: GlobalTaskViewState["columnWidths"] = {}
) =>
  createStore<GlobalTaskViewState, GlobalTaskViewActions>(
    createInitialGlobalTaskViewState(search, columnWidths),
    globalTaskViewActions as StoreActionsFactory<
      GlobalTaskViewState,
      GlobalTaskViewActions
    >
  );

export type GlobalTaskViewStore = ReturnType<typeof createGlobalTaskViewStore>;

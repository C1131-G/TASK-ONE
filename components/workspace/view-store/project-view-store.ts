import type { Store, StoreActionsFactory } from "@tanstack/store";
import { createStore } from "@tanstack/store";

import type { ProjectViewSearch } from "../project-view-search";

// Client UI state for one project page. Server data (tasks, members, labels)
// stays in Server Components; this store only holds how the user is viewing it.
export interface ProjectViewState {
  readonly search: ProjectViewSearch;
}

type ProjectViewStoreSetState = Store<ProjectViewState>["setState"];

export const projectViewActions = ({
  setState,
}: {
  readonly setState: ProjectViewStoreSetState;
}) => ({
  replaceSearch: (search: ProjectViewSearch) =>
    setState((previous) => ({ ...previous, search })),
  setSearch: (patch: Partial<ProjectViewSearch>) =>
    setState((previous) => ({
      ...previous,
      search: { ...previous.search, ...patch },
    })),
});

export type ProjectViewActions = ReturnType<typeof projectViewActions>;

export const createInitialProjectViewState = (
  search: ProjectViewSearch
): ProjectViewState => ({ search });

export const createProjectViewStore = (search: ProjectViewSearch) =>
  createStore<ProjectViewState, ProjectViewActions>(
    createInitialProjectViewState(search),
    projectViewActions as StoreActionsFactory<
      ProjectViewState,
      ProjectViewActions
    >
  );

export type ProjectViewStore = ReturnType<typeof createProjectViewStore>;

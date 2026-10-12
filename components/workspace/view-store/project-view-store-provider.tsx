"use client";

import {
  createStoreContext,
  useCreateStore,
  useSelector,
} from "@tanstack/react-store";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import {
  isSameProjectViewSearch,
  readProjectViewSearchRaw,
  writeProjectViewSearch,
} from "../project-view-search";
import type { TaskTableColumnId } from "../task-table-columns";
import { usePersistColumnWidths } from "./column-width-persistence";
import {
  createInitialProjectViewState,
  projectViewActions,
} from "./project-view-store";
import type { ProjectViewStore } from "./project-view-store";

const { StoreProvider, useStoreContext } = createStoreContext<{
  readonly projectViewStore: ProjectViewStore;
}>();

export const useProjectViewStore = () => useStoreContext().projectViewStore;

// The store is the source for the page; the URL mirrors it so refresh, back and
// forward and shared links restore the same view.
const NO_COLUMN_WIDTHS: Partial<Record<TaskTableColumnId, number>> = {};

export const ProjectViewStoreProvider = ({
  children,
  initialColumnWidths = NO_COLUMN_WIDTHS,
}: {
  readonly children: ReactNode;
  readonly initialColumnWidths?: Partial<Record<TaskTableColumnId, number>>;
}) => {
  const searchParams = useSearchParams();
  const projectViewStore = useCreateStore(
    createInitialProjectViewState(
      readProjectViewSearchRaw(new URLSearchParams(searchParams.toString())),
      initialColumnWidths
    ),
    projectViewActions
  ) as ProjectViewStore;

  // URL changed from outside (navigation, back/forward, saved view link).
  useEffect(() => {
    const incoming = readProjectViewSearchRaw(
      new URLSearchParams(searchParams.toString())
    );
    if (!isSameProjectViewSearch(incoming, projectViewStore.state.search)) {
      projectViewStore.actions.replaceSearch(incoming);
    }
  }, [projectViewStore, searchParams]);

  // Store changed: mirror it into the URL without a server round trip.
  useEffect(() => {
    const subscription = projectViewStore.subscribe(({ search }) => {
      const current = new URLSearchParams(window.location.search);
      const next = writeProjectViewSearch(current, search).toString();
      if (next !== current.toString()) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${next ? `?${next}` : ""}`
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [projectViewStore]);

  const columnWidths = useSelector(
    projectViewStore,
    (state) => state.columnWidths
  );
  usePersistColumnWidths(columnWidths);

  return <StoreProvider value={{ projectViewStore }}>{children}</StoreProvider>;
};

"use client";

import {
  createStoreContext,
  useCreateStore,
  useSelector,
} from "@tanstack/react-store";
import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { usePersistColumnWidths } from "@/features/tasks/hooks/use-persist-column-widths";

import {
  isSameGlobalTaskSearch,
  readGlobalTaskSearchRaw,
  writeGlobalTaskSearch,
} from "../global-task-view-state";
import type { TaskTableColumnId } from "../task-table-columns";
import {
  createInitialGlobalTaskViewState,
  globalTaskViewActions,
} from "./global-task-view-store";
import type { GlobalTaskViewStore } from "./global-task-view-store";

const { StoreProvider, useStoreContext } = createStoreContext<{
  readonly globalTaskViewStore: GlobalTaskViewStore;
}>();

export const useGlobalTaskViewStore = () =>
  useStoreContext().globalTaskViewStore;

// Same contract as the project view: the store leads, the URL follows without a
// server round trip, and navigation back into the URL updates the store.
export const GlobalTaskViewStoreProvider = ({
  children,
  initialColumnWidths,
}: {
  readonly children: ReactNode;
  readonly initialColumnWidths: Partial<Record<TaskTableColumnId, number>>;
}) => {
  const searchParams = useSearchParams();
  const globalTaskViewStore = useCreateStore(
    createInitialGlobalTaskViewState(
      readGlobalTaskSearchRaw(new URLSearchParams(searchParams.toString())),
      initialColumnWidths
    ),
    globalTaskViewActions
  );

  useEffect(() => {
    const incoming = readGlobalTaskSearchRaw(
      new URLSearchParams(searchParams.toString())
    );
    if (!isSameGlobalTaskSearch(incoming, globalTaskViewStore.state.search)) {
      globalTaskViewStore.actions.replaceSearch(incoming);
    }
  }, [globalTaskViewStore, searchParams]);

  useEffect(() => {
    const subscription = globalTaskViewStore.subscribe(({ search }) => {
      const current = new URLSearchParams(window.location.search);
      const next = writeGlobalTaskSearch(current, search).toString();
      if (next !== current.toString()) {
        window.history.replaceState(
          window.history.state,
          "",
          `${window.location.pathname}${next ? `?${next}` : ""}`
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [globalTaskViewStore]);

  const columnWidths = useSelector(
    globalTaskViewStore,
    (state) => state.columnWidths
  );
  const columnWidthPersistence = usePersistColumnWidths(columnWidths);

  return (
    <StoreProvider value={{ globalTaskViewStore }}>
      {columnWidthPersistence.error ? (
        <p role="alert">
          {columnWidthPersistence.error}{" "}
          <button onClick={columnWidthPersistence.handleRetry} type="button">
            Retry
          </button>
        </p>
      ) : null}
      {children}
    </StoreProvider>
  );
};

"use client";

import { useSelector } from "@tanstack/react-store";
import { useMemo } from "react";

import type { GlobalTaskSearch } from "../global-task-view-state";
import { normalizeGlobalTaskSearch } from "../global-task-view-state";
import { useGlobalTaskViewStore } from "../providers/global-task-view-store-provider";

// Reads the workspace task search from the store. `raw` feeds the controls and
// links; `search` is the validated form the filters and views use.
export const useGlobalTaskView = (views: readonly string[]) => {
  const store = useGlobalTaskViewStore();
  const raw: GlobalTaskSearch = useSelector(store, (state) => state.search);
  const search = useMemo(
    () => normalizeGlobalTaskSearch(raw, views),
    [raw, views]
  );
  const update = (patch: Partial<GlobalTaskSearch>) =>
    store.actions.setSearch(patch);
  return { raw, search, update };
};

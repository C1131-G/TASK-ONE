"use client";

import { useSelector } from "@tanstack/react-store";
import { useCallback, useMemo } from "react";

import { normalizeProjectViewSearch } from "../project-view-search";
import type {
  NormalizedProjectViewSearch,
  ProjectViewSearch,
} from "../project-view-search";
import { useProjectViewStore } from "../providers/project-view-store-provider";

export const useProjectViewSearch = () => {
  const projectViewStore = useProjectViewStore();
  const rawSearch = useSelector(projectViewStore, (state) => state.search);
  const search: NormalizedProjectViewSearch = useMemo(
    () => normalizeProjectViewSearch(rawSearch),
    [rawSearch]
  );
  const update = useCallback(
    (patch: Partial<ProjectViewSearch>) =>
      projectViewStore.actions.setSearch(patch),
    [projectViewStore]
  );
  return { search, update };
};

"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import {
  readProjectViewSearch,
  writeProjectViewSearch,
} from "./project-view-search";
import type {
  NormalizedProjectViewSearch,
  ProjectViewSearch,
} from "./project-view-search";

const readRawSearch = (params: URLSearchParams): ProjectViewSearch => {
  const normalized = readProjectViewSearch(params);
  return {
    group: normalized.group,
    priority: normalized.priority,
    q: normalized.q,
    sort: normalized.sort,
    status: normalized.status,
  };
};

// Filters live in the URL so refresh and back/forward keep them. replaceState
// updates useSearchParams without a server round trip for each keystroke.
export const useProjectViewSearch = () => {
  const searchParams = useSearchParams();
  const search: NormalizedProjectViewSearch = useMemo(
    () => readProjectViewSearch(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const update = useCallback((patch: Partial<ProjectViewSearch>) => {
    const current = new URLSearchParams(window.location.search);
    const merged = { ...readRawSearch(current), ...patch };
    const next = writeProjectViewSearch(current, merged).toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}`
    );
  }, []);

  return { search, update };
};

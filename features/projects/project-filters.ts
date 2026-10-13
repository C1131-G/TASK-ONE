import type { Route } from "next";

const statusLabel: Record<string, string> = {
  active: "In Progress",
  complete: "Completed",
  hold: "On Hold",
  planning: "Planning",
  risk: "At Risk",
};

const projectStatuses = [
  "planning",
  "active",
  "risk",
  "hold",
  "complete",
] as const;
const projectSorts = ["recent", "name", "due", "progress"] as const;
const projectViews = ["grid", "list", "table"] as const;

const firstParam = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : "";

const projectHref = (
  values: Readonly<Record<string, string>>,
  view: string
): Route => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value) {
      params.set(key, value);
    }
  }
  params.set("view", view);
  return `/projects?${params.toString()}` as Route;
};

interface ProjectFilters {
  readonly query: string;
  readonly sort: (typeof projectSorts)[number];
  readonly status: (typeof projectStatuses)[number] | "";
  readonly view: (typeof projectViews)[number];
}

const MAX_QUERY_LENGTH = 120;

const parseProjectFilters = (
  params: Readonly<Record<string, string | string[] | undefined>>
): ProjectFilters => {
  const rawStatus = firstParam(params["status"]);
  const rawSort = firstParam(params["sort"]);
  const rawView = firstParam(params["view"]);
  return {
    query: firstParam(params["q"]).trim().slice(0, MAX_QUERY_LENGTH),
    sort: projectSorts.find((option) => option === rawSort) ?? "recent",
    status: projectStatuses.find((status) => status === rawStatus) ?? "",
    view: projectViews.find((option) => option === rawView) ?? "grid",
  };
};

export {
  parseProjectFilters,
  projectHref,
  projectStatuses,
  projectViews,
  statusLabel,
};
export type { ProjectFilters };

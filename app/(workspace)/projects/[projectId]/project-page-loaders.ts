import { cache } from "react";

import { listProjectsAction } from "@/app/actions/projects";
import type { listSavedViewsAction } from "@/app/actions/saved-views";
import { listProjectTasksAction } from "@/app/actions/tasks";
import type { SavedViewSummary } from "@/src/server/preferences/saved-view-contracts";

export const loadProjects = cache(() => listProjectsAction({}));

export type ProjectTaskActionResult = Awaited<
  ReturnType<typeof listProjectTasksAction>
>;
export type ProjectTasks = Extract<
  ProjectTaskActionResult,
  { readonly ok: true }
>["data"];

export const loadProjectTasks = async (
  projectId: string,
  taskCount: number
): Promise<ProjectTaskActionResult> => {
  const pageSize = 200;
  const pageCount = Math.max(1, Math.ceil(taskCount / pageSize));
  const results = await Promise.all(
    Array.from({ length: pageCount }, (_, pageIndex) =>
      listProjectTasksAction({
        limit: pageSize,
        offset: pageIndex * pageSize,
        projectId,
      })
    )
  );
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
  }
  const [firstResult] = results;
  if (!firstResult) {
    throw new Error("Project task pagination returned no page results.");
  }
  if (!firstResult.ok) {
    return firstResult;
  }
  return {
    data: results.flatMap((result) => (result.ok ? result.data : [])),
    ok: true,
    requestId: firstResult.requestId,
  };
};

export const resolveSavedViews = (
  result: Awaited<ReturnType<typeof listSavedViewsAction>>,
  projectId: string,
  userId: string | null,
  requestedView: string
): {
  readonly views: readonly SavedViewSummary[];
  readonly selected: SavedViewSummary | null;
  readonly activeType: string;
} => {
  const views = result.ok
    ? result.data.filter(
        (savedView) =>
          savedView.projectId === projectId &&
          (savedView.userId === userId || savedView.isShared)
      )
    : [];
  const requestedId = requestedView.startsWith("saved-")
    ? requestedView.slice("saved-".length)
    : null;
  const selected =
    views.find((savedView) => savedView.id === requestedId) ?? null;
  return {
    activeType: selected?.type ?? (requestedId ? "board" : requestedView),
    selected,
    views,
  };
};

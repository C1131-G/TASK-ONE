import type { listSavedViews } from "@/features/projects/projects-queries";
import type { SavedViewSummary } from "@/src/server/preferences/saved-view-contracts";

// Picks the saved view named by ?view=saved-<id>, limited to views this user
// may see; plain view names pass through unchanged.
export const resolveSavedViews = (
  result: Awaited<ReturnType<typeof listSavedViews>>,
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

import type { ReactNode } from "react";
import { ViewTransition } from "react";

// A kanban card that glides when a move commits: across columns the stable
// name pairs the old and new card (share), within a column it reflows (update).
// `default="none"` keeps unrelated transitions, such as page navigations, quiet.
export const BoardCardTransition = ({
  children,
  taskId,
}: {
  readonly children: ReactNode;
  readonly taskId: string;
}) => (
  <ViewTransition
    default="none"
    name={`board-card-${taskId}`}
    share="card-move"
    update="card-move"
  >
    {children}
  </ViewTransition>
);

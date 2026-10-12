// Manual order inside one board column. The server orders tasks by position and
// then task number, so a move rewrites positions to match the new visual order.
export const MAX_REORDER_TASKS = 100;

export interface OrderableTask {
  readonly id: string;
  readonly position: number;
  readonly projectTaskNumber: number;
  readonly version: number;
}

export interface PositionChange {
  readonly expectedVersion: number;
  readonly position: number;
  readonly taskId: string;
}

export const orderTasksForBoard = <Task extends OrderableTask>(
  tasks: readonly Task[]
): Task[] =>
  [...tasks].toSorted(
    (first, second) =>
      first.position - second.position ||
      first.projectTaskNumber - second.projectTaskNumber
  );

// Returns null when the move is not possible: at the edge, unknown task, or a
// column too large for one reorder request.
export const moveTaskInColumn = <Task extends OrderableTask>(
  columnTasks: readonly Task[],
  taskId: string,
  direction: -1 | 1
): {
  readonly changes: readonly PositionChange[];
  readonly newIndex: number;
} | null => {
  const ordered = orderTasksForBoard(columnTasks);
  const from = ordered.findIndex((task) => task.id === taskId);
  const to = from + direction;
  if (
    from === -1 ||
    to < 0 ||
    to >= ordered.length ||
    ordered.length > MAX_REORDER_TASKS
  ) {
    return null;
  }
  const next = [...ordered];
  const [moved] = next.splice(from, 1);
  if (!moved) {
    return null;
  }
  next.splice(to, 0, moved);
  // Only tasks whose position changes are sent; unchanged ones already match.
  const changes = next.flatMap((task, index) =>
    task.position === index
      ? []
      : [{ expectedVersion: task.version, position: index, taskId: task.id }]
  );
  return { changes, newIndex: to };
};

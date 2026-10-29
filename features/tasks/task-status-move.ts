// The board shows a dropped card in its new column before the server confirms.
const withTaskStatus = <Task extends { readonly id: string }>(
  tasks: readonly Task[],
  move: {
    readonly status: Task extends { status: infer Status } ? Status : never;
    readonly taskId: string;
  }
): Task[] =>
  tasks.map((task) =>
    task.id === move.taskId ? { ...task, status: move.status } : task
  );

export { withTaskStatus };

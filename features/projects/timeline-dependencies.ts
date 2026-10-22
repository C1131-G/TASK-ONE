import { dayDiff } from "@/features/tasks/task-dates";

// Pixels the arrow runs straight out of a bar before it turns.
const ELBOW = 12;

export interface DependencyTask {
  readonly id: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly dueDate: string | null;
  readonly status: string;
  // Tasks that must finish before this one starts.
  readonly dependencyIds: readonly string[];
}

export interface DependencyLayoutInput {
  readonly barHeight: number;
  readonly barTop: number;
  readonly dayCount: number;
  readonly dayWidth: number;
  readonly from: string;
  readonly rowHeight: number;
  // Row index of every task that is on screen; a task missing here is hidden.
  readonly rowIndexById: ReadonlyMap<string, number>;
  // Every task the timeline knows about, shown or not.
  readonly tasks: readonly DependencyTask[];
}

export interface DependencyArrow {
  readonly blockerId: string;
  readonly clippedEnd: boolean;
  readonly clippedStart: boolean;
  // The dependent starts before the blocker ends.
  readonly conflict: boolean;
  readonly cyclic: boolean;
  readonly id: string;
  readonly path: string;
  readonly taskId: string;
}

export interface TaskDependencyDetail {
  readonly conflict: boolean;
  // A sentence for assistive technology, or null when the task has no links.
  readonly description: string | null;
}

export interface DependencyLayout {
  readonly arrows: readonly DependencyArrow[];
  readonly details: ReadonlyMap<string, TaskDependencyDetail>;
}

interface Span {
  readonly end: string;
  readonly start: string;
}

const spanOf = (task: DependencyTask): Span | null => {
  const start = task.startDate ?? task.dueDate;
  const end = task.dueDate ?? task.startDate;
  return start && end ? { end, start } : null;
};

const joinNames = (names: readonly string[]): string => names.join(", ");

// An edge is circular when its dependent can already reach its blocker by
// following the "blocks" direction.
const findCyclicEdges = (
  tasks: readonly DependencyTask[],
  known: ReadonlySet<string>
): ReadonlySet<string> => {
  const blocks = new Map<string, string[]>();
  for (const task of tasks) {
    for (const blockerId of task.dependencyIds) {
      if (known.has(blockerId)) {
        blocks.set(blockerId, [...(blocks.get(blockerId) ?? []), task.id]);
      }
    }
  }
  const reaches = (origin: string, target: string): boolean => {
    const seen = new Set<string>([origin]);
    const queue = [origin];
    for (const current of queue) {
      if (current === target) {
        return true;
      }
      for (const next of blocks.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return false;
  };
  const cyclic = new Set<string>();
  for (const task of tasks) {
    for (const blockerId of task.dependencyIds) {
      if (known.has(blockerId) && reaches(task.id, blockerId)) {
        cyclic.add(`${blockerId}:${task.id}`);
      }
    }
  }
  return cyclic;
};

const arrowPath = (
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
  detourY: number
): string => {
  if (end.x - start.x >= ELBOW * 2) {
    return `M ${start.x} ${start.y} H ${start.x + ELBOW} V ${end.y} H ${end.x}`;
  }
  // No room to turn between the bars: leave the blocker, run along the edge of
  // the dependent's row, and come in from the left.
  return `M ${start.x} ${start.y} H ${start.x + ELBOW} V ${detourY} H ${Math.max(0, end.x - ELBOW)} V ${end.y} H ${end.x}`;
};

const REASON_TEXT: Readonly<
  Record<
    "hidden" | "outside" | "unknown" | "unscheduled",
    (name: string) => string
  >
> = {
  hidden: (name) => `${name} is hidden by the current filters`,
  outside: (name) => `the link from ${name} is outside the visible dates`,
  unknown: () => "another task is not on this timeline",
  unscheduled: (name) => `${name} has no dates`,
};

const skipReasonOf = (parts: {
  readonly blocker: DependencyTask | undefined;
  readonly blockerRow: number | undefined;
  readonly blockerSpan: Span | null;
  readonly dependentSpan: Span | null;
  readonly taskRow: number | undefined;
}): string | null => {
  const { blocker, blockerRow, blockerSpan, dependentSpan, taskRow } = parts;
  if (!blocker) {
    return REASON_TEXT.unknown("");
  }
  if (!blockerSpan) {
    return REASON_TEXT.unscheduled(blocker.title);
  }
  if (!dependentSpan) {
    return REASON_TEXT.unscheduled("this task");
  }
  if (blockerRow === undefined || taskRow === undefined) {
    return REASON_TEXT.hidden(blocker.title);
  }
  return null;
};

interface Notes {
  readonly blockedBy: Map<string, string[]>;
  readonly blocks: Map<string, string[]>;
  readonly circular: Map<string, Set<string>>;
  readonly conflicts: Map<string, string[]>;
  readonly notDrawn: Map<string, string[]>;
}

const addNote = (map: Map<string, string[]>, key: string, value: string) => {
  map.set(key, [...(map.get(key) ?? []), value]);
};

const addCircular = (notes: Notes, key: string, value: string) => {
  notes.circular.set(key, (notes.circular.get(key) ?? new Set()).add(value));
};

const describeTask = (taskId: string, notes: Notes): TaskDependencyDetail => {
  const sentences: string[] = [];
  const incoming = notes.blockedBy.get(taskId);
  if (incoming) {
    sentences.push(`Blocked by ${joinNames(incoming)}.`);
  }
  const late = notes.conflicts.get(taskId);
  if (late) {
    sentences.push(`Starts before its blocker ends: ${late.join("; ")}.`);
  }
  const skipped = notes.notDrawn.get(taskId);
  if (skipped) {
    sentences.push(`Not drawn: ${skipped.join("; ")}.`);
  }
  const outgoing = notes.blocks.get(taskId);
  if (outgoing) {
    sentences.push(`Blocks ${joinNames(outgoing)}.`);
  }
  const loop = notes.circular.get(taskId);
  if (loop) {
    sentences.push(`Circular dependency through ${joinNames([...loop])}.`);
  }
  return {
    conflict: late !== undefined,
    description: sentences.length > 0 ? sentences.join(" ") : null,
  };
};

// Wording for the links of one task that the text description reports.
const recordLinks = (
  notes: Notes,
  task: DependencyTask,
  blocker: DependencyTask | undefined,
  cyclic: boolean
) => {
  addNote(notes.blockedBy, task.id, blocker?.title ?? "another task");
  if (!blocker) {
    return;
  }
  addNote(notes.blocks, blocker.id, task.title);
  if (cyclic) {
    addCircular(notes, task.id, blocker.title);
    addCircular(notes, blocker.id, task.title);
  }
};

export const computeDependencyLayout = (
  input: DependencyLayoutInput
): DependencyLayout => {
  const { dayCount, dayWidth, from, rowHeight, rowIndexById, tasks } = input;
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const cyclicEdges = findCyclicEdges(tasks, new Set(byId.keys()));
  const width = dayCount * dayWidth;
  const rowCenter = (row: number): number =>
    row * rowHeight + input.barTop + input.barHeight / 2;
  const arrows: DependencyArrow[] = [];
  const notes: Notes = {
    blockedBy: new Map(),
    blocks: new Map(),
    circular: new Map(),
    conflicts: new Map(),
    notDrawn: new Map(),
  };

  for (const task of tasks) {
    const dependentSpan = spanOf(task);
    const taskRow = rowIndexById.get(task.id);
    for (const blockerId of task.dependencyIds) {
      const blocker = byId.get(blockerId);
      const cyclic = cyclicEdges.has(`${blockerId}:${task.id}`);
      recordLinks(notes, task, blocker, cyclic);
      const blockerSpan = blocker ? spanOf(blocker) : null;
      const blockerRow = rowIndexById.get(blockerId);
      const skipReason = skipReasonOf({
        blocker,
        blockerRow,
        blockerSpan,
        dependentSpan,
        taskRow,
      });
      if (
        !blocker ||
        !blockerSpan ||
        !dependentSpan ||
        blockerRow === undefined ||
        taskRow === undefined
      ) {
        addNote(notes.notDrawn, task.id, skipReason ?? REASON_TEXT.unknown(""));
        continue;
      }
      // Only a task that is still open can hold up the work behind it.
      const conflict =
        blocker.status !== "done" && dependentSpan.start < blockerSpan.end;
      if (conflict) {
        addNote(
          notes.conflicts,
          task.id,
          `${blocker.title} ends ${blockerSpan.end}`
        );
      }
      const rawStart = (dayDiff(from, blockerSpan.end) + 1) * dayWidth;
      const rawEnd = dayDiff(from, dependentSpan.start) * dayWidth;
      if (rawStart >= width || dayDiff(from, dependentSpan.end) < 0) {
        addNote(notes.notDrawn, task.id, REASON_TEXT.outside(blocker.title));
        continue;
      }
      const detourY =
        taskRow > blockerRow ? taskRow * rowHeight : (taskRow + 1) * rowHeight;
      arrows.push({
        blockerId,
        clippedEnd: rawEnd > width,
        clippedStart: rawStart < 0,
        conflict,
        cyclic,
        id: `${blockerId}:${task.id}`,
        path: arrowPath(
          { x: Math.max(0, rawStart), y: rowCenter(blockerRow) },
          { x: Math.min(width, rawEnd), y: rowCenter(taskRow) },
          detourY
        ),
        taskId: task.id,
      });
    }
  }

  return {
    arrows,
    details: new Map(
      tasks.map((task) => [task.id, describeTask(task.id, notes)])
    ),
  };
};

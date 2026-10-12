/* eslint-disable shadcn/no-unknown-classes */

"use client";

import { useId, useRef, useState } from "react";

import { WorkspaceTimelineChart } from "@/components/workspace/workspace-timeline-chart";
import { WorkspaceTimelineControls } from "@/components/workspace/workspace-timeline-controls";
import type {
  TimelineEmployee,
  TimelineGroup,
  TimelineRow,
  TimelineScale,
  TimelineTask,
} from "@/components/workspace/workspace-timeline-types";

const DAY_MS = 86_400_000;
const DAY_WIDTH = { month: 12, week: 32 } as const;
const STATUS_LABELS: Readonly<Record<string, string>> = {
  backlog: "Backlog",
  done: "Done",
  progress: "In Progress",
  review: "Review",
  todo: "To Do",
};
const PRIORITY_ORDER: Readonly<Record<string, number>> = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
};
const EMPTY_EMPLOYEES: readonly TimelineEmployee[] = [];

const getOffset = (value: string, start: number): number =>
  Math.round((Date.parse(`${value}T00:00:00Z`) - start) / DAY_MS);

const groupTasks = (
  tasks: readonly TimelineTask[],
  groupBy: string,
  employeesById: ReadonlyMap<string, string>
): TimelineGroup[] => {
  const groups = new Map<string, TimelineGroup>();
  for (const task of tasks) {
    const assignees = (task.assigneeIds ?? []).map(
      (id) => employeesById.get(id) ?? "Employee"
    );
    let group: Pick<TimelineGroup, "key" | "label">;
    if (groupBy === "project") {
      group = { key: task.projectId, label: task.projectName };
    } else if (groupBy === "status") {
      group = {
        key: task.status,
        label: STATUS_LABELS[task.status] ?? task.status,
      };
    } else {
      group = {
        key: assignees.join("+") || "unassigned",
        label: assignees.join(", ") || "Unassigned",
      };
    }
    const existing = groups.get(group.key);
    groups.set(group.key, {
      ...group,
      tasks: existing ? [...existing.tasks, task] : [task],
    });
  }
  return [...groups.values()];
};

export const WorkspaceTimeline = ({
  from,
  to,
  tasks,
  employees = EMPTY_EMPLOYEES,
}: {
  readonly from: string;
  readonly to: string;
  readonly tasks: readonly TimelineTask[];
  readonly employees?: readonly TimelineEmployee[];
}) => {
  const id = useId();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sortBy, setSortBy] = useState("manual");
  const [groupBy, setGroupBy] = useState("project");
  const [scale, setScale] = useState<TimelineScale>("week");
  const start = Date.parse(`${from}T00:00:00Z`);
  const dayCount = Math.max(
    1,
    Math.ceil((Date.parse(`${to}T00:00:00Z`) - start) / DAY_MS) + 1
  );
  const dayWidth = DAY_WIDTH[scale];
  const employeesById = new Map(
    employees.map(({ id: employeeId, name }) => [employeeId, name])
  );
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleTasks = tasks
    .filter((task) => {
      const assigneeIds = task.assigneeIds ?? [];
      return (
        (normalizedQuery.length === 0 ||
          task.title.toLocaleLowerCase().includes(normalizedQuery) ||
          task.projectName.toLocaleLowerCase().includes(normalizedQuery)) &&
        (status === "all" || task.status === status) &&
        (priority === "all" || task.priority === priority) &&
        (assignee === "all" || assigneeIds.includes(assignee))
      );
    })
    .toSorted((left, right) => {
      if (sortBy === "title") {
        return left.title.localeCompare(right.title);
      }
      if (sortBy === "dueDate") {
        return (left.dueDate ?? "9999-12-31").localeCompare(
          right.dueDate ?? "9999-12-31"
        );
      }
      if (sortBy === "priority") {
        return (
          (PRIORITY_ORDER[left.priority ?? "none"] ?? 4) -
          (PRIORITY_ORDER[right.priority ?? "none"] ?? 4)
        );
      }
      if (sortBy === "startDate") {
        return (left.startDate ?? left.dueDate ?? "9999-12-31").localeCompare(
          right.startDate ?? right.dueDate ?? "9999-12-31"
        );
      }
      return (left.position ?? 0) - (right.position ?? 0);
    });
  const groups =
    groupBy === "none"
      ? [{ key: "all", label: "Tasks", tasks: visibleTasks }]
      : groupTasks(visibleTasks, groupBy, employeesById);
  const rows: TimelineRow[] = [];
  for (const group of groups) {
    if (groupBy !== "none") {
      rows.push({
        key: `group:${group.key}`,
        label: group.label,
        type: "group",
      });
    }
    for (const task of group.tasks) {
      rows.push({ key: task.id, task, type: "task" });
    }
  }
  // eslint-disable-next-line react/purity -- The marker represents today's date.
  const today = getOffset(new Date().toISOString().slice(0, 10), start);
  const jumpToToday = () => {
    if (today < 0 || today >= dayCount) {
      return;
    }
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    viewportRef.current?.scrollTo({
      behavior: reduceMotion ? "instant" : "smooth",
      left: Math.max(0, today * dayWidth - 160),
    });
  };

  return (
    <section
      aria-label="Workspace task timeline"
      className="panel timeline-panel"
    >
      <WorkspaceTimelineControls
        assignee={assignee}
        employees={employees}
        groupBy={groupBy}
        id={id}
        onAssigneeChange={setAssignee}
        onGroupChange={setGroupBy}
        onPriorityChange={setPriority}
        onQueryChange={setQuery}
        onScaleChange={setScale}
        onSortChange={setSortBy}
        onStatusChange={setStatus}
        onToday={jumpToToday}
        priority={priority}
        query={query}
        scale={scale}
        sortBy={sortBy}
        status={status}
      />
      {rows.length ? (
        <WorkspaceTimelineChart
          dayCount={dayCount}
          dayWidth={dayWidth}
          from={from}
          rows={rows}
          scale={scale}
          today={today}
          viewportRef={viewportRef}
        />
      ) : (
        <div className="panel-b muted">
          No tasks match these timeline filters. Adjust the search or filters.
        </div>
      )}
    </section>
  );
};

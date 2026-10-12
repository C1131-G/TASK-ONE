/* eslint-disable shadcn/no-unknown-classes -- Workspace classes are defined in workspace-reference.css. */

import type { Metadata } from "next";
import { connection } from "next/server";

import { getPersonalWorkspaceAction } from "@/app/actions/discovery";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { MyTasksWorkspace } from "@/components/workspace/my-tasks-workspace";
import type { AssignedTask } from "@/components/workspace/my-tasks-workspace";
import {
  currentUtcMonthRange,
  currentUtcWeekRange,
} from "@/src/lib/utc-date-range";
import { getPageSession } from "@/src/server/auth/page-session";

export const metadata: Metadata = { title: "My Tasks | Metsys" };

interface MyTasksSearchParams {
  readonly calendarMode?: string;
  readonly monthOffset?: string;
  readonly priority?: string;
  readonly q?: string;
  readonly sort?: string;
  readonly status?: string;
  readonly view?: string;
}

interface DueGroup {
  readonly id: string;
  readonly label: string;
  readonly tasks: readonly AssignedTask[];
}

const PRIORITY_ORDER = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
} as const;
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});
const WEEK_LABEL_FORMATTER = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const TODAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});

const dateKey = (): string => TODAY_FORMATTER.format(new Date());

const groupTasksByDueDate = (
  tasks: readonly AssignedTask[],
  today: string
): readonly DueGroup[] => {
  const tasksByGroup = new Map<string, AssignedTask[]>([
    ["overdue", []],
    ["today", []],
    ["upcoming", []],
    ["no-date", []],
    ["completed", []],
  ]);
  for (const task of tasks) {
    let groupId: string;
    if (task.status === "done") {
      groupId = "completed";
    } else if (task.dueDate === null) {
      groupId = "no-date";
    } else if (task.dueDate < today) {
      groupId = "overdue";
    } else if (task.dueDate === today) {
      groupId = "today";
    } else {
      groupId = "upcoming";
    }
    tasksByGroup.get(groupId)?.push(task);
  }
  const labels: Readonly<Record<string, string>> = {
    completed: "Completed",
    "no-date": "No due date",
    overdue: "Overdue",
    today: "Today",
    upcoming: "Upcoming",
  };
  const groups: DueGroup[] = [];
  for (const [id, groupTasks] of tasksByGroup.entries()) {
    if (groupTasks.length > 0) {
      groups.push({ id, label: labels[id] ?? id, tasks: groupTasks });
    }
  }
  return groups;
};

const filterAndSortTasks = (
  tasks: readonly AssignedTask[],
  params: MyTasksSearchParams
): AssignedTask[] => {
  const query = params.q?.trim().toLocaleLowerCase() ?? "";
  const selectedStatus = params.status ?? "all";
  const selectedPriority = params.priority ?? "all";
  const filtered: AssignedTask[] = [];
  for (const task of tasks) {
    if (selectedStatus !== "all" && task.status !== selectedStatus) {
      continue;
    }
    if (selectedPriority !== "all" && task.priority !== selectedPriority) {
      continue;
    }
    const searchableText = `${task.title} ${task.projectName} ${task.projectKey}`;
    if (query && !searchableText.toLocaleLowerCase().includes(query)) {
      continue;
    }
    filtered.push(task);
  }
  const sort = params.sort ?? "due";
  filtered.sort((left, right) => {
    if (sort === "name") {
      return left.title.localeCompare(right.title);
    }
    if (sort === "priority") {
      return PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
    }
    return (left.dueDate ?? "9999-12-31").localeCompare(
      right.dueDate ?? "9999-12-31"
    );
  });
  return filtered;
};

const MyTasksPage = async ({
  searchParams,
}: {
  readonly searchParams: Promise<MyTasksSearchParams>;
}) => {
  await connection();
  const [params, session, projectResult, employeeResult, personal] =
    await Promise.all([
      searchParams,
      getPageSession(),
      listProjectsAction({}),
      listEmployeesAction({ search: "" }),
      getPersonalWorkspaceAction({}),
    ]);
  if (session.kind !== "authenticated" || !projectResult.ok) {
    return (
      <div className="page">
        <div className="panel panel-b" role="alert">
          Your tasks could not be loaded. Refresh to retry.
        </div>
      </div>
    );
  }

  const taskLists = await Promise.all(
    projectResult.data.map(async (project) => ({
      project,
      result: await listProjectTasksAction({
        limit: 100,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  const assignedTasks: AssignedTask[] = [];
  for (const { project, result } of taskLists) {
    if (!result.ok) {
      continue;
    }
    for (const task of result.data) {
      if (task.assigneeIds.includes(session.user.id)) {
        assignedTasks.push({
          ...task,
          projectId: project.id,
          projectKey: project.key,
          projectName: project.name,
        });
      }
    }
  }
  const tasks = filterAndSortTasks(assignedTasks, params);
  const groups = groupTasksByDueDate(tasks, dateKey());
  const view = params.view === "calendar" ? "calendar" : "list";
  const requestedOffset = Number(params.monthOffset ?? 0);
  const monthOffset = Number.isInteger(requestedOffset)
    ? Math.max(-24, Math.min(24, requestedOffset))
    : 0;
  const calendarMode = params.calendarMode === "week" ? "week" : "month";
  const range =
    calendarMode === "week"
      ? currentUtcWeekRange(monthOffset)
      : currentUtcMonthRange(monthOffset, 1);
  const monthLabel =
    calendarMode === "week"
      ? `${WEEK_LABEL_FORMATTER.format(new Date(`${range.from}T12:00:00Z`))} – ${WEEK_LABEL_FORMATTER.format(new Date(`${range.to}T12:00:00Z`))}`
      : MONTH_LABEL_FORMATTER.format(new Date(`${range.from}T12:00:00Z`));
  const calendarTasks = tasks.map((task) => ({
    assigneeIds: task.assigneeIds,
    createdById: task.createdById,
    dependencyIds: task.dependencyIds,
    dueDate: task.dueDate,
    id: task.id,
    labelIds: task.labelIds,
    position: task.position,
    priority: task.priority,
    projectId: task.projectId,
    projectName: task.projectName,
    recurrence: task.recurrence,
    status: task.status,
    title: task.title,
    version: task.version,
  }));
  const calendarProjects = projectResult.data.map(({ color, id, name }) => ({
    color,
    id,
    name,
  }));
  const employees = employeeResult.ok ? employeeResult.data : [];
  const dueSummaryParts: string[] = [];
  for (const group of groups) {
    if (["overdue", "today", "upcoming"].includes(group.id)) {
      const description = group.id === "today" ? "due today" : group.id;
      dueSummaryParts.push(`${group.tasks.length} ${description}`);
    }
  }

  return (
    <MyTasksWorkspace
      calendarMode={calendarMode}
      calendarProjects={calendarProjects}
      calendarTasks={calendarTasks}
      dueSummary={dueSummaryParts.join(" · ")}
      employees={employees}
      favoriteTaskIds={
        new Set(personal.ok ? personal.data.tasks.map(({ id }) => id) : [])
      }
      groups={groups}
      isAdmin={session.user.role === "admin"}
      monthLabel={monthLabel}
      monthOffset={monthOffset}
      params={params}
      tasks={tasks}
      totalAssignedTasks={assignedTasks.length}
      userId={session.user.id}
      view={view}
    />
  );
};

export default MyTasksPage;

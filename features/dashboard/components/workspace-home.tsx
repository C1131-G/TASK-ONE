/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { listActivity } from "@/features/activity/activity-queries";
import {
  HomeStats,
  MyTasksPanel,
  ProjectProgressPanel,
  RecentActivityPanel,
  UpcomingDeadlinesPanel,
} from "@/features/dashboard/components/home-panels";
import type { TaskViewLists } from "@/features/dashboard/components/home-panels";
import { getDashboardOverview } from "@/features/dashboard/dashboard-queries";
import type { HomeTaskView } from "@/features/dashboard/home-task-view";
import { listEmployees } from "@/features/people/people-queries";
import { ProjectCreateForm } from "@/features/projects/components/project-create-form";
import { listProjects } from "@/features/projects/projects-queries";
import { QuickTaskForm } from "@/features/tasks/components/quick-task-form";
import { listProjectTasks } from "@/features/tasks/tasks-queries";
import { getPageSession } from "@/src/server/auth/page-session";

const greetingAt = (hour: number): string => {
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
};

const DATE_PART_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Kolkata",
  year: "numeric",
});
const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  dateStyle: "full",
  timeZone: "Asia/Kolkata",
});
const HOUR_FORMATTER = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: "Asia/Kolkata",
});

const localDateString = (date: Date): string => {
  const parts = DATE_PART_FORMATTER.formatToParts(date);
  const part = (type: "year" | "month" | "day") =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const WorkspaceHome = async ({
  taskView,
}: {
  readonly taskView: HomeTaskView;
}) => {
  await connection();
  const [dashboardResult, projectResult, session, employeesResult] =
    await Promise.all([
      getDashboardOverview({}),
      listProjects({}),
      getPageSession(),
      listEmployees({ search: "" }),
    ]);
  if (!dashboardResult.ok || !projectResult.ok) {
    return (
      <div className="page">
        <section aria-live="polite" className="panel panel-b">
          <h1>Workspace unavailable</h1>
          <p className="muted">
            Refresh the page to retry loading your workspace data.
          </p>
        </section>
      </div>
    );
  }

  const userId = session.kind === "authenticated" ? session.user.id : null;
  const isAdmin =
    session.kind === "authenticated" && session.user.role === "admin";
  const employee =
    userId && employeesResult.ok
      ? employeesResult.data.find((item) => item.id === userId)
      : null;
  // eslint-disable-next-line react/purity -- Request-time dashboard dates follow the workspace time zone.
  const now = new Date();
  const today = localDateString(now);
  const activeProjects = projectResult.data.filter(
    (project) => project.status !== "complete"
  );
  const projectTasks = await Promise.all(
    activeProjects.map(async (project) => ({
      project,
      result: await listProjectTasks({
        limit: 200,
        offset: 0,
        projectId: project.id,
      }),
    }))
  );
  const allTasks = projectTasks.flatMap(({ project, result }) =>
    result.ok
      ? result.data.map((task) => ({
          ...task,
          projectColor: project.color,
          projectKey: project.key,
          projectName: project.name,
        }))
      : []
  );
  const myTasks = allTasks.filter((task) =>
    task.assigneeIds.includes(userId ?? "")
  );
  const taskViews: TaskViewLists = {
    completed: myTasks.filter((task) => task.status === "done"),
    overdue: myTasks
      .filter(
        (task) =>
          task.status !== "done" &&
          task.dueDate !== null &&
          task.dueDate < today
      )
      .toSorted((left, right) =>
        (left.dueDate ?? "").localeCompare(right.dueDate ?? "")
      ),
    upcoming: myTasks
      .filter(
        (task) =>
          task.status !== "done" && (!task.dueDate || task.dueDate >= today)
      )
      .toSorted((left, right) =>
        (left.dueDate ?? "9999-12-31").localeCompare(
          right.dueDate ?? "9999-12-31"
        )
      ),
  };
  const openTasks = allTasks.filter((task) => task.status !== "done");
  const completedThisWeek = allTasks.filter(
    (task) =>
      task.completedAt &&
      Date.parse(task.completedAt) >= now.getTime() - 7 * 24 * 60 * 60 * 1000
  );
  const overdueCount = openTasks.filter(
    (task) => task.dueDate !== null && task.dueDate < today
  ).length;
  const deadlineGroups = [
    {
      name: "Today",
      tasks: openTasks.filter((task) => task.dueDate === today),
    },
    {
      name: "Tomorrow",
      tasks: openTasks.filter(
        (task) =>
          task.dueDate === localDateString(new Date(now.getTime() + 86_400_000))
      ),
    },
    {
      name: "This week",
      tasks: openTasks.filter(
        (task) =>
          task.dueDate !== null &&
          task.dueDate >
            localDateString(new Date(now.getTime() + 86_400_000)) &&
          task.dueDate <=
            localDateString(new Date(now.getTime() + 7 * 86_400_000))
      ),
    },
  ];
  const activityResults = await Promise.all(
    activeProjects
      .slice(0, 10)
      .map((project) => listActivity({ limit: 7, projectId: project.id }))
  );
  const activities = activityResults
    .flatMap((result) => (result.ok ? result.data : []))
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 7);
  const membersById = new Map(
    employeesResult.ok
      ? employeesResult.data.map((directoryEmployee) => [
          directoryEmployee.id,
          directoryEmployee,
        ])
      : []
  );
  // eslint-disable-next-line react/purity -- This server-rendered date follows the user's workspace time zone.
  const todayLabel = FULL_DATE_FORMATTER.format(now);

  return (
    <div className="page">
      <div className="ph">
        <div>
          <h1>
            {greetingAt(Number(HOUR_FORMATTER.format(now)))},{" "}
            {employee?.name.split(" ")[0] ?? "there"}
          </h1>
          <p>{todayLabel} · Here is what is happening across your workspace.</p>
        </div>
        <div className="acts">
          <Link className="btn btn-secondary hide-m" href={"/members" as Route}>
            Invite member
          </Link>
          {isAdmin ? <ProjectCreateForm /> : null}
          {projectResult.data.length ? (
            <QuickTaskForm
              projects={projectResult.data.map(({ id, name }) => ({
                id,
                name,
              }))}
            />
          ) : null}
        </div>
      </div>
      <HomeStats
        activeProjects={activeProjects.length}
        atRisk={dashboardResult.data.projects.risk}
        assignedTasks={myTasks.filter((task) => task.status !== "done").length}
        completed={completedThisWeek.length}
        openTasks={openTasks.length}
        overdue={overdueCount}
      />
      <div className="grid2 home-columns">
        <div className="stack">
          <MyTasksPanel taskView={taskView} taskViews={taskViews} />
          <ProjectProgressPanel
            projects={activeProjects}
            membersById={membersById}
          />
        </div>
        <div className="stack">
          <UpcomingDeadlinesPanel groups={deadlineGroups} />
          <RecentActivityPanel activities={activities} />
        </div>
      </div>
    </div>
  );
};

const WorkspaceHomeSkeleton = () => (
  <div className="page">
    <div className="ph">
      <div>
        <h1>Home</h1>
        <p className="muted">Loading your dashboard…</p>
      </div>
    </div>
    <span aria-hidden="true" className="sk home-stats-skeleton" />
    <div className="grid2 home-columns">
      <div className="stack">
        <PanelSkeleton label="Loading your tasks…" rows={5} title="My tasks" />
        <PanelSkeleton
          label="Loading project progress…"
          rows={4}
          title="Projects"
        />
      </div>
      <div className="stack">
        <PanelSkeleton
          label="Loading deadlines…"
          rows={3}
          title="Upcoming deadlines"
        />
        <PanelSkeleton
          label="Loading activity…"
          rows={4}
          title="Recent activity"
        />
      </div>
    </div>
  </div>
);

export { WorkspaceHome, WorkspaceHomeSkeleton };

/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */

import type { Route } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { listActivityAction } from "@/app/actions/activity";
import { getDashboardOverviewAction } from "@/app/actions/dashboard";
import { listEmployeesAction } from "@/app/actions/employees";
import { listProjectsAction } from "@/app/actions/projects";
import { listProjectTasksAction } from "@/app/actions/tasks";
import { listTeamsAction } from "@/app/actions/teams";
import {
  HomeStats,
  MyTasksPanel,
  ProjectProgressPanel,
  RecentActivityPanel,
  UpcomingDeadlinesPanel,
} from "@/components/workspace/home-panels";
import type { TaskViewLists } from "@/components/workspace/home-panels";
import { ProjectCreateForm } from "@/components/workspace/project-create-form";
import { QuickTaskForm } from "@/components/workspace/quick-task-form";
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
  taskView = "upcoming",
}: {
  readonly taskView?: "upcoming" | "overdue" | "completed";
}) => {
  await connection();
  const [
    dashboardResult,
    projectResult,
    session,
    teamsResult,
    employeesResult,
  ] = await Promise.all([
    getDashboardOverviewAction({}),
    listProjectsAction({}),
    getPageSession(),
    listTeamsAction({}),
    listEmployeesAction({ search: "" }),
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
      result: await listProjectTasksAction({
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
      .map((project) => listActivityAction({ limit: 7, projectId: project.id }))
  );
  const activities = activityResults
    .flatMap((result) => (result.ok ? result.data : []))
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 7);
  const teamNameById = new Map(
    teamsResult.ok ? teamsResult.data.map((team) => [team.id, team.name]) : []
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
          {isAdmin ? (
            <Link
              className="btn btn-secondary hide-m"
              href={"/projects" as Route}
            >
              New project
            </Link>
          ) : null}
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
      {isAdmin ? <ProjectCreateForm /> : null}
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
            teamNames={teamNameById}
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

export { WorkspaceHome };

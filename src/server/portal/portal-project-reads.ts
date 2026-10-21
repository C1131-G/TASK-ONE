import { and } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";

import { AppError } from "../core/action-result";
import type { Transaction } from "../work/work-internal";
import { run } from "./portal-bug-access";
import type { PortalActor } from "./portal-contracts";
import type {
  PortalSharedProjectDetail,
  PortalSharedProjectSummary,
} from "./portal-project-contracts";

// A project reaches a client only when it is assigned to the client's company
// (and not taken off it) AND an administrator marked it shared. Either alone
// is not enough, and an archived project is never shown.
const loadSharedProjects = async (
  transaction: Transaction,
  actor: PortalActor,
  onlyProjectId?: string
) => {
  const links = await transaction.orm.public.ClientCompanyProject.where({
    companyId: actor.clientCompanyId,
    removedAt: null,
  })
    .select("projectId")
    .all();
  const assigned: string[] = [];
  for (const { projectId } of links) {
    if (onlyProjectId === undefined || projectId === onlyProjectId) {
      assigned.push(projectId);
    }
  }
  if (assigned.length === 0) {
    return [];
  }
  const projects = await transaction.orm.public.Project.where((project) =>
    and(
      project.id.in(assigned),
      project.clientVisible.eq(true),
      project.archivedAt.isNull()
    )
  ).all();
  return projects.toSorted((first, second) =>
    first.name.localeCompare(second.name)
  );
};

// Tasks an employee explicitly marked "show to client", ordinary tasks only
// (bugs have their own portal pages), and only the fields a client may see.
const loadSharedTasks = async (
  transaction: Transaction,
  projectIds: readonly string[]
) =>
  await transaction.orm.public.Task.where((task) =>
    and(
      task.projectId.in([...projectIds]),
      task.clientVisible.eq(true),
      task.archivedAt.isNull(),
      task.type.eq("task")
    )
  )
    .select(
      "id",
      "projectId",
      "projectTaskNumber",
      "title",
      "status",
      "dueDate"
    )
    .all();

const loadUpcomingMilestones = async (
  transaction: Transaction,
  projectIds: readonly string[]
) => {
  const milestones = await transaction.orm.public.ProjectMilestone.where(
    (milestone) =>
      and(
        milestone.projectId.in([...projectIds]),
        milestone.completedAt.isNull()
      )
  ).all();
  const NO_DATE = "9999-12-31";
  return milestones.toSorted(
    (first, second) =>
      (first.dueDate ?? NO_DATE).localeCompare(second.dueDate ?? NO_DATE) ||
      first.position - second.position
  );
};

const summarize = (
  project: Awaited<ReturnType<typeof loadSharedProjects>>[number],
  tasks: Awaited<ReturnType<typeof loadSharedTasks>>,
  milestones: Awaited<ReturnType<typeof loadUpcomingMilestones>>
): PortalSharedProjectSummary => {
  const next = milestones.find(({ projectId }) => projectId === project.id);
  const shared = tasks.filter(({ projectId }) => projectId === project.id);
  return {
    description: project.description,
    dueDate: project.dueDate,
    id: project.id,
    key: project.key,
    name: project.name,
    nextMilestone: next ? { dueDate: next.dueDate, name: next.name } : null,
    progress: {
      done: shared.filter(({ status }) => status === "done").length,
      total: shared.length,
    },
    status: project.status,
  };
};

export const listSharedProjects = (
  actor: PortalActor
): Effect.Effect<readonly PortalSharedProjectSummary[], AppError> =>
  run(async (transaction) => {
    const projects = await loadSharedProjects(transaction, actor);
    if (projects.length === 0) {
      return [];
    }
    const projectIds = projects.map(({ id }) => id);
    const [tasks, milestones] = await Promise.all([
      loadSharedTasks(transaction, projectIds),
      loadUpcomingMilestones(transaction, projectIds),
    ]);
    return projects.map((project) => summarize(project, tasks, milestones));
  });

// A project the company may not see reads as missing, so its existence is
// never confirmed.
export const getSharedProject = (
  actor: PortalActor,
  projectId: string
): Effect.Effect<PortalSharedProjectDetail, AppError> =>
  run(async (transaction) => {
    const [project] = await loadSharedProjects(transaction, actor, projectId);
    if (!project) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The project was not found.",
      });
    }
    const [tasks, milestones] = await Promise.all([
      loadSharedTasks(transaction, [project.id]),
      loadUpcomingMilestones(transaction, [project.id]),
    ]);
    return {
      ...summarize(project, tasks, milestones),
      milestones: milestones.map(({ dueDate, id, name }) => ({
        dueDate,
        id,
        name,
      })),
      tasks: tasks
        .toSorted(
          (first, second) => first.projectTaskNumber - second.projectTaskNumber
        )
        .map(({ dueDate, id, status, title }) => ({
          dueDate,
          id,
          status,
          title,
        })),
    };
  });

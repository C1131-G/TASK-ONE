import { Effect } from "effect";

import {
  budgetListRoute,
  portalProjectListRoute,
  projectListRoute,
} from "../../../mobile-api/routes-projects";
import { AuthSession } from "../../auth/session";
import {
  ProjectBudgetsLive,
  ProjectBudgets,
} from "../../budgets/project-budgets";
import { PortalBugs } from "../../portal/portal-contracts";
import { ProjectManagement } from "../../projects/project-contracts";
import { ProjectManagementLive } from "../../projects/project-management";
import { asPortalCaller } from "../bugs/caller";
import { pageOf } from "../paging";
import { readRouteInput } from "../route-input";

export const listWorkspaceProjects = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(projectListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const projects = yield* (yield* ProjectManagement).listProjects(actor.id);
    const rows = projects.map((project) => ({
      clientVisible: project.clientVisible,
      dueDate: project.dueDate,
      id: project.id,
      key: project.key,
      name: project.name,
      openTaskCount: project.openTaskCount,
      overdueTaskCount: project.overdueTaskCount,
      progress: project.progress,
      status: project.status,
      taskCount: project.taskCount,
    }));
    return yield* pageOf(rows, ({ id }) => id, query);
  }).pipe(Effect.provide(ProjectManagementLive));

export const listWorkspaceBudgets = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(budgetListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const budgets = yield* (yield* ProjectBudgets).list(actor.id, new Date());
    return yield* pageOf(budgets, ({ projectId }) => projectId, query);
  }).pipe(Effect.provide(ProjectBudgetsLive));

export const listPortalProjectPage = (request: Request) =>
  asPortalCaller(portalProjectListRoute, request, {}, ({ actor, input }) =>
    Effect.gen(function* list() {
      const projects = yield* (yield* PortalBugs).listProjects(actor);
      return yield* pageOf(
        projects.map(({ id, key, name }) => ({ id, key, name })),
        ({ id }) => id,
        input.query
      );
    })
  );

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { ProjectListItem } from "./project-contracts";
import { mapError, toSummary } from "./project-internal";

export const listProjects = (
  requesterId: string,
  options: { readonly includeArchived?: boolean } = {}
): Effect.Effect<readonly ProjectListItem[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const requester = await db.orm.public.User.where({ id: requesterId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!requester || requester.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (requester.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      const projects = await db.orm.public.Project.where(
        options.includeArchived ? {} : { archivedAt: null }
      )
        .orderBy((project) => project.position.asc())
        .all();
      const projectIds = projects.map(({ id }) => id);
      const [members, tasks] = await Promise.all([
        db.orm.public.ProjectMember.where((member) =>
          member.projectId.in(projectIds)
        )
          .select("projectId", "userId")
          .all(),
        db.orm.public.Task.where((task) => task.projectId.in(projectIds))
          .select("projectId", "status", "archivedAt")
          .all(),
      ]);
      return projects.map((project) => {
        const projectTasks = tasks.flatMap((task) =>
          task.projectId === project.id && !task.archivedAt ? [task] : []
        );
        const taskCount = projectTasks.length;
        let completedTaskCount = 0;
        for (const task of projectTasks) {
          if (task.status === "done") {
            completedTaskCount += 1;
          }
        }
        return {
          ...toSummary(project),
          completedTaskCount,
          leadId: project.leadId,
          memberIds: members.flatMap((member) =>
            member.projectId === project.id ? [member.userId] : []
          ),
          progress:
            taskCount === 0
              ? 0
              : Math.round((completedTaskCount / taskCount) * 100),
          taskCount,
        };
      });
    },
  });

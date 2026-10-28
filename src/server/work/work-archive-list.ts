import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import { databaseError } from "./work-internal";

export const ARCHIVED_TASK_WINDOW = 500;

export interface ArchivedItem {
  readonly archivedAt: string;
  readonly id: string;
  readonly kind: "project" | "task";
  readonly projectName: string | null;
  readonly title: string;
  readonly version: number;
}

// The newest archived ordinary tasks, with their project's name. Bugs follow
// the bug workflow, so they are not listed here. Only the latest
// ARCHIVED_TASK_WINDOW tasks are read so the answer stays bounded.
export const listArchivedTasks = (): Effect.Effect<
  readonly ArchivedItem[],
  AppError
> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async (): Promise<readonly ArchivedItem[]> => {
      const tasks = await db.orm.public.Task.where((task) =>
        and(task.archivedAt.isNotNull(), task.type.eq("task"))
      )
        .orderBy((task) => task.archivedAt.desc())
        .orderBy((task) => task.id.desc())
        .limit(ARCHIVED_TASK_WINDOW)
        .all();
      const projectIds = [...new Set(tasks.map(({ projectId }) => projectId))];
      const projects = await db.orm.public.Project.where((project) =>
        project.id.in(projectIds)
      )
        .select("id", "name")
        .all();
      const nameById = new Map(projects.map(({ id, name }) => [id, name]));
      return tasks.flatMap((task) =>
        task.archivedAt
          ? [
              {
                archivedAt: task.archivedAt.toISOString(),
                id: task.id,
                kind: "task" as const,
                projectName: nameById.get(task.projectId) ?? null,
                title: task.title,
                version: task.version,
              },
            ]
          : []
      );
    },
  });

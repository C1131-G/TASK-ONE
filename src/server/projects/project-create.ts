import { randomUUID } from "node:crypto";

import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import type { AppError } from "../core/action-result";
import type { CreateProjectInput, ProjectSummary } from "./project-contracts";
import {
  mapError,
  PROJECT_STARTER_TASKS,
  toSummary,
  validateAdmin,
  validateCreateProjectInput,
  validateProjectTeam,
  writeActivity,
} from "./project-internal";

export const createProject = (
  actorId: string,
  raw: CreateProjectInput
): Effect.Effect<ProjectSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const input = validateCreateProjectInput(raw);
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        await validateProjectTeam(transaction, input.teamId);
        const now = new Date();
        const id = randomUUID();
        const project = await transaction.orm.public.Project.create({
          archivedAt: null,
          archivedById: null,
          color: input.color ?? "slate",
          createdAt: now,
          description: input.description,
          dueDate: input.dueDate ?? null,
          icon: input.icon ?? "folder",
          id,
          key: input.key,
          leadId: null,
          name: input.name,
          position: 0,
          startDate: input.startDate ?? null,
          status: input.status,
          teamId: input.teamId ?? null,
          updatedAt: now,
          version: 1,
        });
        const starterTasks = PROJECT_STARTER_TASKS[input.templateId ?? "blank"];
        if (starterTasks.length > 0) {
          await transaction.orm.public.ProjectTaskCounter.upsert({
            conflictOn: { projectId: project.id },
            create: {
              nextNumber: starterTasks.length + 1,
              projectId: project.id,
              updatedAt: now,
            },
            update: {
              nextNumber: starterTasks.length + 1,
              updatedAt: now,
            },
          });
          await Promise.all(
            starterTasks.map((title, position) =>
              transaction.orm.public.Task.create({
                archivedAt: null,
                archivedById: null,
                completedAt: null,
                createdAt: now,
                createdById: actorId,
                description: null,
                dueDate: null,
                estimate: null,
                id: randomUUID(),
                position,
                priority: "none",
                projectId: project.id,
                projectTaskNumber: position + 1,
                startDate: null,
                status: "todo",
                title,
                updatedAt: now,
                version: 1,
              })
            )
          );
        }
        await writeActivity(transaction, actorId, id, "project.created", {
          key: input.key,
          name: input.name,
        });
        return toSummary(project);
      });
    },
  });

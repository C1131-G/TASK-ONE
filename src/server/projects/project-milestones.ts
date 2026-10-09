import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema } from "../core/input-schemas";
import type {
  ProjectMilestoneInput,
  ProjectMilestonesResult,
} from "./project-contracts";
import {
  mapError,
  validateAdmin,
  validateVersion,
  writeActivity,
} from "./project-internal";

export const listProjectMilestones = (
  requesterId: string,
  projectId: string
): Effect.Effect<ProjectMilestonesResult, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const user = await db.orm.public.User.where({ id: requesterId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!user || user.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (user.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      const project = await db.orm.public.Project.where({
        id: projectId,
      }).first();
      if (!project || project.archivedAt) {
        throw new AppError({
          code: "NOT_FOUND",
          message: "The project was not found.",
        });
      }
      const milestones = await db.orm.public.ProjectMilestone.where({
        projectId,
      })
        .orderBy((milestone) => milestone.position.asc())
        .all();
      return {
        milestones: milestones.map(
          ({ completedAt, dueDate, id, name, position }) => ({
            completed: completedAt !== null,
            dueDate,
            id,
            name,
            position,
          })
        ),
        projectId,
        version: project.version,
      };
    },
  });

const validateMilestones = (milestones: readonly ProjectMilestoneInput[]) => {
  if (milestones.length > 100) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A project can have at most 100 milestones.",
    });
  }
  const ids = new Set<string>();
  return milestones.map((milestone) => {
    const name = milestone.name.trim();
    if (!name || name.length > 120) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Milestone names must be between 1 and 120 characters.",
      });
    }
    if (milestone.id && ids.has(milestone.id)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "A milestone cannot appear more than once.",
      });
    }
    if (milestone.id) {
      ids.add(milestone.id);
    }
    if (
      milestone.dueDate !== null &&
      !Schema.is(CalendarDateSchema)(milestone.dueDate)
    ) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Enter a valid milestone date.",
      });
    }
    return { ...milestone, name };
  });
};

export const saveProjectMilestones = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  raw: readonly ProjectMilestoneInput[]
): Effect.Effect<ProjectMilestonesResult, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
      const milestones = validateMilestones(raw);
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        const project = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!project) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        if (project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived projects are read only.",
          });
        }
        if (project.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        const existing = await transaction.orm.public.ProjectMilestone.where({
          projectId,
        }).all();
        const existingIds = new Set(existing.map(({ id }) => id));
        if (
          milestones.some(
            (milestone) => milestone.id && !existingIds.has(milestone.id)
          )
        ) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "A milestone was not found in this project.",
          });
        }
        const keepIds = new Set(
          milestones.flatMap(({ id }) => (id ? [id] : []))
        );
        await Promise.all(
          existing.flatMap((milestone) =>
            keepIds.has(milestone.id)
              ? []
              : [
                  transaction.orm.public.ProjectMilestone.where({
                    id: milestone.id,
                  }).delete(),
                ]
          )
        );
        await Promise.all(
          milestones.map((milestone, position) => {
            const completedAt = milestone.completed
              ? (existing.find(({ id }) => id === milestone.id)?.completedAt ??
                new Date())
              : null;
            return milestone.id
              ? transaction.orm.public.ProjectMilestone.where({
                  id: milestone.id,
                  projectId,
                }).update({
                  completedAt,
                  dueDate: milestone.dueDate,
                  name: milestone.name,
                  position,
                })
              : transaction.orm.public.ProjectMilestone.create({
                  completedAt,
                  createdAt: new Date(),
                  dueDate: milestone.dueDate,
                  id: randomUUID(),
                  name: milestone.name,
                  position,
                  projectId,
                });
          })
        );
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount({ updatedAt: new Date(), version });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        await writeActivity(
          transaction,
          actorId,
          projectId,
          "project.milestones_updated",
          { milestoneCount: milestones.length }
        );
        const saved = await transaction.orm.public.ProjectMilestone.where({
          projectId,
        })
          .orderBy((milestone) => milestone.position.asc())
          .all();
        return {
          milestones: saved.map(
            ({ completedAt, dueDate, id, name, position }) => ({
              completed: completedAt !== null,
              dueDate,
              id,
              name,
              position,
            })
          ),
          projectId,
          version,
        };
      });
    },
  });

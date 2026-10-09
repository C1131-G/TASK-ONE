import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type {
  ProjectWithPeople,
  SetProjectPeopleInput,
} from "./project-contracts";
import {
  mapError,
  toSummary,
  validateAdmin,
  validateVersion,
  writeActivity,
} from "./project-internal";

export const setProjectPeople = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  input: SetProjectPeopleInput
): Effect.Effect<ProjectWithPeople, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
      const memberIds = [
        ...new Set([
          ...input.memberIds,
          ...(input.leadId ? [input.leadId] : []),
        ]),
      ];
      if (memberIds.length > 100) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A project can have at most 100 members.",
        });
      }
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
        const users = await transaction.orm.public.User.where((user) =>
          user.id.in(memberIds)
        )
          .select("id", "deactivatedAt")
          .all();
        if (
          users.length !== memberIds.length ||
          users.some((user) => user.deactivatedAt)
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose active accounts for every project member.",
          });
        }
        await transaction.orm.public.ProjectMember.where({
          projectId,
        }).deleteAll();
        await Promise.all(
          memberIds.map((userId) =>
            transaction.orm.public.ProjectMember.create({
              joinedAt: new Date(),
              projectId,
              userId,
            })
          )
        );
        const version = expectedVersion + 1;
        const updatedCount = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount({
          leadId: input.leadId,
          updatedAt: new Date(),
          version,
        });
        if (!updatedCount) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        const updated = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        await writeActivity(
          transaction,
          actorId,
          projectId,
          "project.people_updated",
          { leadId: input.leadId, memberIds: memberIds.length }
        );
        return { ...toSummary(updated), leadId: input.leadId, memberIds };
      });
    },
  });

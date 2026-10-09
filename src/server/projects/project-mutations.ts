import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { ProjectSummary, UpdateProjectInput } from "./project-contracts";
import {
  mapError,
  toSummary,
  validateAdmin,
  validateProjectTeam,
  validateUpdateProjectInput,
  validateVersion,
  writeActivity,
} from "./project-internal";

const validateProjectMutationState = (
  operation: "update" | "archive" | "restore",
  project: { readonly archivedAt: Date | null }
): void => {
  if (operation === "archive" && project.archivedAt) {
    throw new AppError({
      code: "CONFLICT",
      message: "The project is already archived.",
    });
  }
  if (operation === "restore" && !project.archivedAt) {
    throw new AppError({
      code: "CONFLICT",
      message: "The project is already active.",
    });
  }
  if (operation !== "restore" && project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived projects are read only.",
    });
  }
};

const projectMutationAction = (
  operation: "update" | "archive" | "restore"
): string => {
  switch (operation) {
    case "update": {
      return "project.updated";
    }
    case "archive": {
      return "project.archived";
    }
    case "restore": {
      return "project.restored";
    }
    default: {
      throw new Error("Unsupported project operation.");
    }
  }
};

const projectMutationValues = (
  operation: "update" | "archive" | "restore",
  input: UpdateProjectInput | null,
  actorId: string,
  nextVersion: number
) => {
  if (operation === "update" && input) {
    return {
      description: input.description,
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      name: input.name,
      ...(input.position === undefined ? {} : { position: input.position }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      status: input.status,
      ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
      updatedAt: new Date(),
      version: nextVersion,
    };
  }
  return {
    archivedAt: operation === "archive" ? new Date() : null,
    archivedById: operation === "archive" ? actorId : null,
    updatedAt: new Date(),
    version: nextVersion,
  };
};

const mutateProject = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  operation: "update" | "archive" | "restore",
  raw?: UpdateProjectInput
): Effect.Effect<ProjectSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
      const input =
        operation === "update"
          ? validateUpdateProjectInput(
              raw ?? { description: null, name: "", status: "planning" }
            )
          : null;
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        if (input) {
          await validateProjectTeam(transaction, input.teamId);
        }
        const project = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!project) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        if (project.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        validateProjectMutationState(operation, project);
        const nextVersion = expectedVersion + 1;
        const updatedCount = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount(
          projectMutationValues(operation, input, actorId, nextVersion)
        );
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
          projectMutationAction(operation),
          {
            version: nextVersion,
          }
        );
        return toSummary(updated);
      });
    },
  });

export const updateProject = (
  actorId: string,
  id: string,
  version: number,
  input: UpdateProjectInput
) => mutateProject(actorId, id, version, "update", input);
export const archiveProject = (actorId: string, id: string, version: number) =>
  mutateProject(actorId, id, version, "archive");
export const restoreProject = (actorId: string, id: string, version: number) =>
  mutateProject(actorId, id, version, "restore");

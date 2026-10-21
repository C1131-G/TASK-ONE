import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { ProjectClientVisibility } from "./project-contracts";
import {
  mapError,
  validateAdmin,
  validateVersion,
  writeActivity,
} from "./project-internal";

// Sharing a project with its client companies is an administrator decision.
// Which companies see it is still the client company's project assignment;
// this flag is the second gate, so assigning a project never publishes it.
export const setProjectClientVisibility = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  visible: boolean
): Effect.Effect<ProjectClientVisibility, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
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
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount({
          clientVisible: visible,
          updatedAt: new Date(),
          version,
        });
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
          visible
            ? "project.shared_with_clients"
            : "project.hidden_from_clients",
          { version }
        );
        return { clientVisible: visible, id: projectId, version };
      });
    },
  });

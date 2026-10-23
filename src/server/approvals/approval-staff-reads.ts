import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { taskSubjectKey } from "./approval-access";
import type { TaskApprovals } from "./approval-contracts";
import {
  assertStaffReader,
  describeRequests,
  isUuid,
} from "./approval-staff-shared";

const notFound = () =>
  new AppError({ code: "NOT_FOUND", message: "The task was not found." });

const forTaskInternal = async (
  actorId: string,
  taskId: string
): Promise<TaskApprovals> => {
  const actor = await assertStaffReader(actorId);
  if (!isUuid(taskId)) {
    throw notFound();
  }
  const task = await db.orm.public.Task.include("project")
    .where({ id: taskId })
    .first();
  if (!task) {
    throw notFound();
  }
  const [rows, assignments, links] = await Promise.all([
    db.orm.public.ApprovalRequest.where({
      subjectKey: taskSubjectKey(taskId),
    }).all(),
    db.orm.public.TaskAssignee.where({ taskId }).select("userId").all(),
    db.orm.public.ClientCompanyProject.where({
      projectId: task.projectId,
      removedAt: null,
    })
      .select("companyId")
      .all(),
  ]);
  const { companies, requests } = await describeRequests(
    rows,
    links.map(({ companyId }) => companyId)
  );
  const shared =
    task.clientVisible &&
    task.project.clientVisible &&
    !task.archivedAt &&
    !task.project.archivedAt;
  const mayEdit =
    actor.role === "admin" ||
    task.createdById === actorId ||
    assignments.some(({ userId }) => userId === actorId);
  const active = new Set(links.map(({ companyId }) => companyId));
  return {
    canRequest: shared && mayEdit && task.type === "task",
    companies: shared
      ? companies
          .flatMap(({ deactivatedAt, id, name }) =>
            !deactivatedAt && active.has(id) ? [{ id, name }] : []
          )
          .toSorted((first, second) => first.name.localeCompare(second.name))
      : [],
    requests,
  };
};

export const forTask = (
  actorId: string,
  taskId: string
): Effect.Effect<TaskApprovals, AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNAVAILABLE",
            message: "Approvals could not be loaded.",
          }),
    try: () => forTaskInternal(actorId, taskId),
  });

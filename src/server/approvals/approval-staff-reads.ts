import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { taskSubjectKey, toApprovalStatus } from "./approval-access";
import type { TaskApprovals } from "./approval-contracts";

const isUuid = Schema.is(UUIDSchema);

const notFound = () =>
  new AppError({ code: "NOT_FOUND", message: "The task was not found." });

const forTaskInternal = async (
  actorId: string,
  taskId: string
): Promise<TaskApprovals> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "role")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.role === "client" || actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Approvals are managed by the team.",
    });
  }
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
  const companyIds = [
    ...new Set([
      ...links.map(({ companyId }) => companyId),
      ...rows.map(({ companyId }) => companyId),
    ]),
  ];
  const userIds = [
    ...new Set(
      rows.flatMap(({ decidedById, requestedById }) =>
        decidedById ? [requestedById, decidedById] : [requestedById]
      )
    ),
  ];
  const [companies, users, attachments] = await Promise.all([
    companyIds.length === 0
      ? []
      : db.orm.public.ClientCompany.where((company) =>
          company.id.in(companyIds)
        )
          .select("id", "name", "deactivatedAt")
          .all(),
    userIds.length === 0
      ? []
      : db.orm.public.User.where((user) => user.id.in(userIds))
          .select("id", "name")
          .all(),
    rows.length === 0
      ? []
      : db.orm.public.ApprovalRequestFile.include("file")
          .where((attached) => attached.requestId.in(rows.map(({ id }) => id)))
          .all(),
  ]);
  const companyNames = new Map(companies.map(({ id, name }) => [id, name]));
  const userNames = new Map(users.map(({ id, name }) => [id, name]));
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
    requests: rows
      .toSorted((first, second) => second.version - first.version)
      .map((row) => ({
        cancelledAt: row.cancelledAt?.toISOString() ?? null,
        companyId: row.companyId,
        companyName: companyNames.get(row.companyId) ?? "",
        decidedAt: row.decidedAt?.toISOString() ?? null,
        decidedByName: row.decidedById
          ? (userNames.get(row.decidedById) ?? null)
          : null,
        decisionComment: row.decisionComment,
        files: attachments.flatMap(({ file, requestId }) =>
          requestId === row.id
            ? [{ fileId: file.id, fileName: file.originalName }]
            : []
        ),
        id: row.id,
        message: row.message,
        requestedAt: row.requestedAt.toISOString(),
        requestedByName: userNames.get(row.requestedById) ?? "",
        status: toApprovalStatus(row.status),
        version: row.version,
      })),
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

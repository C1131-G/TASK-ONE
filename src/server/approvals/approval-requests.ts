import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import type { Transaction } from "../work/work-internal";
import { assertOrdinaryTask } from "../work/work-internal";
import {
  assertTaskEditPermission,
  assertWorkspaceActor,
} from "../work/work-task-state";
import { milestoneSubjectKey, taskSubjectKey } from "./approval-access";
import type {
  ApprovalReceipt,
  RequestApprovalInput,
} from "./approval-contracts";
import { MAX_APPROVAL_FILES } from "./approval-contracts";
import { notifyClientsOfRequest } from "./approval-notify";

const invalid = (message: string) =>
  new AppError({ code: "VALIDATION_FAILED", message });

const forbidden = (message: string) =>
  new AppError({ code: "FORBIDDEN", message });

const toError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
    return new AppError({
      code: "CONFLICT",
      message: "An approval was requested at the same time. Refresh and retry.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The approval request could not be completed.",
  });
};

const loadStaffActor = async (transaction: Transaction, actorId: string) => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("name", "role", "mustChangePassword", "deactivatedAt")
    .first();
  assertWorkspaceActor(actor);
  if (actor.role === "client") {
    throw forbidden("Clients cannot request approvals.");
  }
  return actor;
};

interface Subject {
  readonly key: string;
  readonly milestoneId: string | null;
  readonly projectId: string;
  readonly taskId: string | null;
  readonly title: string;
}

// The thing being approved. A task needs someone who may edit it; a
// milestone, which administrators manage, needs an administrator. Both must
// already be visible to clients.
const loadSubject = async (
  transaction: Transaction,
  actorId: string,
  actorRole: string,
  input: RequestApprovalInput
): Promise<Subject> => {
  const { milestoneId, taskId } = input;
  if ((taskId === undefined) === (milestoneId === undefined)) {
    throw invalid("Choose a task or a milestone to send for approval.");
  }
  if (taskId !== undefined) {
    const task = await transaction.orm.public.Task.include("project")
      .where({ id: taskId })
      .first();
    if (!task) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The task was not found.",
      });
    }
    assertOrdinaryTask(task);
    if (task.archivedAt || task.project.archivedAt) {
      throw forbidden("Archived tasks are read only.");
    }
    const assignments = await transaction.orm.public.TaskAssignee.where({
      taskId,
    })
      .select("userId")
      .all();
    assertTaskEditPermission(
      { deactivatedAt: null, mustChangePassword: false, role: actorRole },
      actorId,
      task.createdById,
      assignments
    );
    if (!task.clientVisible || !task.project.clientVisible) {
      throw invalid(
        "Share the task with the client before asking for approval."
      );
    }
    return {
      key: taskSubjectKey(taskId),
      milestoneId: null,
      projectId: task.projectId,
      taskId,
      title: task.title,
    };
  }
  if (actorRole !== "admin") {
    throw forbidden("Only administrators can request approval of a milestone.");
  }
  const milestone = await transaction.orm.public.ProjectMilestone.include(
    "project"
  )
    .where({ id: milestoneId })
    .first();
  if (!milestone) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The milestone was not found.",
    });
  }
  if (!milestone.project.clientVisible || milestone.project.archivedAt) {
    throw invalid(
      "Share the project with the client before asking for approval."
    );
  }
  return {
    key: milestoneSubjectKey(milestone.id),
    milestoneId: milestone.id,
    projectId: milestone.projectId,
    taskId: null,
    title: milestone.name,
  };
};

const assertCompanyHasProject = async (
  transaction: Transaction,
  companyId: string,
  projectId: string
) => {
  const [link, company] = await Promise.all([
    transaction.orm.public.ClientCompanyProject.where({
      companyId,
      projectId,
      removedAt: null,
    })
      .select("id")
      .first(),
    transaction.orm.public.ClientCompany.where({ id: companyId })
      .select("deactivatedAt")
      .first(),
  ]);
  if (!link || !company || company.deactivatedAt) {
    throw invalid("Choose a company this project is shared with.");
  }
};

// Only finished uploads of this very task (or of the project, for a
// milestone) can be shown to the client.
const assertRequestFiles = async (
  transaction: Transaction,
  subject: Subject,
  fileIds: readonly string[]
) => {
  const found = await transaction.orm.public.FileAsset.where((file) =>
    and(file.id.in([...fileIds]), file.deletedAt.isNull())
  )
    .select("id", "projectId", "taskId", "copyState")
    .all();
  const wanted = new Set(fileIds);
  const usable = found.every(
    (file) =>
      file.projectId === subject.projectId &&
      file.copyState === "ready" &&
      (subject.taskId === null || file.taskId === subject.taskId)
  );
  if (found.length !== wanted.size || !usable) {
    throw invalid("Choose finished files that belong to this work.");
  }
};

const nextVersion = async (
  transaction: Transaction,
  subject: Subject,
  companyId: string
): Promise<number> => {
  const versions = await transaction.orm.public.ApprovalRequest.where({
    companyId,
    subjectKey: subject.key,
  })
    .select("version", "status")
    .all();
  if (versions.some(({ status }) => status === "pending")) {
    throw new AppError({
      code: "CONFLICT",
      message: "An approval is already waiting for the client.",
    });
  }
  if (versions.some(({ status }) => status === "approved")) {
    throw new AppError({
      code: "CONFLICT",
      message: "The client already approved this.",
    });
  }
  return Math.max(0, ...versions.map(({ version }) => version)) + 1;
};

export const requestApproval = (
  actorId: string,
  input: RequestApprovalInput
): Effect.Effect<ApprovalReceipt, AppError> =>
  Effect.tryPromise({
    catch: toError,
    try: () =>
      db.transaction(async (transaction) => {
        const actor = await loadStaffActor(transaction, actorId);
        const message = input.message.trim();
        const fileIds = [...new Set(input.fileIds)];
        if (!message) {
          throw invalid("Write a message for the client.");
        }
        if (fileIds.length === 0 || fileIds.length > MAX_APPROVAL_FILES) {
          throw invalid(
            `Attach between 1 and ${MAX_APPROVAL_FILES} files to review.`
          );
        }
        const subject = await loadSubject(
          transaction,
          actorId,
          actor.role,
          input
        );
        await assertCompanyHasProject(
          transaction,
          input.companyId,
          subject.projectId
        );
        await assertRequestFiles(transaction, subject, fileIds);
        const version = await nextVersion(
          transaction,
          subject,
          input.companyId
        );
        const now = new Date();
        const id = randomUUID();
        await transaction.orm.public.ApprovalRequest.create({
          cancelledAt: null,
          cancelledById: null,
          companyId: input.companyId,
          decidedAt: null,
          decidedById: null,
          decisionComment: null,
          id,
          message,
          milestoneId: subject.milestoneId,
          projectId: subject.projectId,
          requestedAt: now,
          requestedById: actorId,
          status: "pending",
          subjectKey: subject.key,
          subjectTitle: subject.title,
          taskId: subject.taskId,
          version,
        });
        await Promise.all(
          fileIds.map((fileId) =>
            transaction.orm.public.ApprovalRequestFile.create({
              fileId,
              id: randomUUID(),
              requestId: id,
            })
          )
        );
        await notifyClientsOfRequest(transaction, {
          actorId,
          companyId: input.companyId,
          id,
          message,
          now,
          projectId: subject.projectId,
          subjectTitle: subject.title,
          version,
        });
        return { id, version };
      }),
  });

// Withdraws a request the client has not answered. The person who asked and
// administrators may do it; once the client decided it stays on record.
export const cancelApproval = (
  actorId: string,
  requestId: string
): Effect.Effect<void, AppError> =>
  Effect.tryPromise({
    catch: toError,
    try: () =>
      db.transaction(async (transaction) => {
        const [actor, request] = await Promise.all([
          loadStaffActor(transaction, actorId),
          transaction.orm.public.ApprovalRequest.where({
            id: requestId,
          }).first(),
        ]);
        if (!request) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The approval request was not found.",
          });
        }
        if (actor.role !== "admin" && request.requestedById !== actorId) {
          throw forbidden("You cannot cancel this approval request.");
        }
        const now = new Date();
        const changed = await transaction.orm.public.ApprovalRequest.where({
          id: requestId,
          status: "pending",
        }).updateAndCount({
          cancelledAt: now,
          cancelledById: actorId,
          status: "cancelled",
        });
        if (changed) {
          return;
        }
        // Cancelling twice is fine; cancelling a decided request is not.
        const current = await transaction.orm.public.ApprovalRequest.where({
          id: requestId,
        })
          .select("status")
          .first();
        if (current?.status !== "cancelled") {
          throw new AppError({
            code: "CONFLICT",
            message: "The client already answered this request.",
          });
        }
      }),
  });

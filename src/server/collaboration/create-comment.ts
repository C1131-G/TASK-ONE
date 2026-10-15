import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { notifyUsers } from "../notifications/notify-users";
import type { CommentVisibility, CreatedComment } from "./contracts";
import { mapError, uuidSchema, extractMentionIds } from "./internal";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const forbidden = (message: string) =>
  new AppError({ code: "FORBIDDEN", message });

// Client users who should hear about a public reply: the reporter and anyone
// else from the company who has already joined the conversation.
export const clientParticipantIds = async (
  transaction: Transaction,
  bug: { readonly reporterId: string; readonly taskId: string }
): Promise<string[]> => {
  const authors = await transaction.orm.public.Comment.where({
    deletedAt: null,
    taskId: bug.taskId,
    visibility: "public",
  })
    .select("authorId")
    .all();
  const candidateIds = [
    ...new Set([bug.reporterId, ...authors.map(({ authorId }) => authorId)]),
  ];
  const clients = await transaction.orm.public.User.where((user) =>
    and(
      user.id.in(candidateIds),
      user.role.eq("client"),
      user.deactivatedAt.isNull()
    )
  )
    .select("id")
    .all();
  return clients.map(({ id }) => id);
};

const assertCommentAllowed = (
  actor: { readonly role: string; readonly clientCompanyId: string | null },
  bug: {
    readonly clientCompanyId: string | null;
    readonly status: string;
  } | null,
  visibility: CommentVisibility
): void => {
  if (visibility === "public" && !bug?.clientCompanyId) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Only comments on client bugs can be public.",
    });
  }
  if (actor.role !== "client") {
    return;
  }
  if (
    !bug ||
    !actor.clientCompanyId ||
    bug.clientCompanyId !== actor.clientCompanyId ||
    visibility !== "public"
  ) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The active task was not found.",
    });
  }
  if (["closed", "duplicate", "withdrawn"].includes(bug.status)) {
    throw forbidden("Closed bugs are read only.");
  }
};

// A client bug belongs to whoever picked it up: other employees follow along
// but do not comment.
const assertHandlerMayComment = async (
  transaction: Transaction,
  actor: { readonly id: string; readonly role: string },
  taskId: string,
  bug: { readonly clientCompanyId: string | null } | null
): Promise<void> => {
  if (!bug?.clientCompanyId || actor.role !== "employee") {
    return;
  }
  const assignment = await transaction.orm.public.TaskAssignee.where({
    taskId,
    userId: actor.id,
  })
    .select("userId")
    .first();
  if (!assignment) {
    throw forbidden(
      "Only the assigned handler or an admin can comment on a client bug."
    );
  }
};

// Adds a comment and notifies the right people. Internal comments never reach
// a client; public comments are the only ones a client can see or write.
export const createCommentInTransaction = async (
  transaction: Transaction,
  input: {
    readonly actorId: string;
    readonly taskId: string;
    readonly body: string;
    readonly visibility: CommentVisibility;
    // Replaces the usual "replied to your bug report" client notice.
    readonly clientNotice?: string;
  }
): Promise<CreatedComment> => {
  const { actorId, taskId, visibility } = input;
  const body = input.body.trim();
  if (!Schema.is(uuidSchema)(taskId) || !body || body.length > 10_000) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Comments must contain 1 to 10,000 characters.",
    });
  }
  const mentionIds = extractMentionIds(body);
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select(
      "role",
      "name",
      "mustChangePassword",
      "deactivatedAt",
      "clientCompanyId"
    )
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword) {
    throw forbidden("Change your password before continuing.");
  }
  const task = await transaction.orm.public.Task.where({
    archivedAt: null,
    id: taskId,
  })
    .select("createdById", "id", "projectId")
    .first();
  if (!task) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The active task was not found.",
    });
  }
  const bug = await transaction.orm.public.BugReport.where({ taskId })
    .select("id", "clientCompanyId", "reporterId", "status")
    .first();
  assertCommentAllowed(actor, bug, visibility);
  await assertHandlerMayComment(
    transaction,
    { id: actorId, role: actor.role },
    taskId,
    bug
  );
  if (mentionIds.length > 0) {
    const mentioned = await transaction.orm.public.User.where((user) =>
      and(
        user.id.in([...mentionIds]),
        user.deactivatedAt.isNull(),
        user.role.neq("client")
      )
    )
      .select("id")
      .all();
    if (mentioned.length !== mentionIds.length) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "A mentioned employee is not active.",
      });
    }
  }

  const id = randomUUID();
  const createdAt = new Date();
  await transaction.orm.public.Comment.create({
    authorId: actorId,
    body,
    createdAt,
    deletedAt: null,
    deletedById: null,
    id,
    taskId,
    updatedAt: createdAt,
    visibility,
  });
  await transaction.orm.public.Activity.create({
    action: "comment.created",
    actorId,
    createdAt,
    details: { commentId: id, visibility },
    id: randomUUID(),
    projectId: task.projectId,
    taskId,
  });
  const snippet = body.slice(0, 240);
  const staffUrl = bug ? `/bugs/${bug.id}` : `/tasks/${taskId}`;
  await notifyUsers(transaction, {
    actorId,
    now: createdAt,
    projectId: task.projectId,
    recipientIds: mentionIds,
    snippet,
    taskId,
    text: `${actor.name} mentioned you`,
    type: "mention",
    url: `/tasks/${taskId}`,
  });
  const assignmentRows = await transaction.orm.public.TaskAssignee.where({
    taskId,
  })
    .select("userId")
    .all();
  const mentionedIds = new Set(mentionIds);
  const staffRecipients = [
    ...new Set([task.createdById, ...assignmentRows.map((row) => row.userId)]),
  ].filter((userId) => !mentionedIds.has(userId));
  // The reporter created the task, so on an internal comment they would
  // otherwise be told about a note they must never see.
  const staffUsers = await transaction.orm.public.User.where((user) =>
    and(user.id.in(staffRecipients), user.role.neq("client"))
  )
    .select("id")
    .all();
  const staffOnly = staffUsers.map(({ id: userId }) => userId);
  await notifyUsers(transaction, {
    actorId,
    now: createdAt,
    projectId: task.projectId,
    recipientIds: staffOnly,
    snippet,
    taskId,
    text: `${actor.name} commented on a task`,
    type: "comment",
    url: staffUrl,
  });
  if (visibility === "public" && bug) {
    const clientRecipients = await clientParticipantIds(transaction, {
      reporterId: bug.reporterId,
      taskId,
    });
    await notifyUsers(transaction, {
      actorId,
      now: createdAt,
      projectId: task.projectId,
      recipientIds: clientRecipients,
      snippet,
      taskId,
      text: input.clientNotice ?? `${actor.name} replied to your bug report`,
      type: "comment",
      url: `/portal/bugs/${bug.id}`,
    });
  }
  return {
    authorId: actorId,
    body,
    createdAt: createdAt.toISOString(),
    id,
    taskId,
    visibility,
  };
};

export const createComment = (
  actorId: string,
  taskId: string,
  body: string,
  visibility: CommentVisibility = "internal"
): Effect.Effect<CreatedComment, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () =>
      db.transaction((transaction) =>
        createCommentInTransaction(transaction, {
          actorId,
          body,
          taskId,
          visibility,
        })
      ),
  });

import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect, Layer } from "effect";

import {
  clientStatusLabel,
  internalStatusesFor,
} from "@/features/portal/client-status";
import { db } from "@/src/prisma/db";

import { createCommentInTransaction } from "../collaboration/create-comment";
import { AppError } from "../core/action-result";
import { createBugReport } from "../work/bug-management";
import {
  CLIENT_REOPEN_LIMIT,
  confirmClientFix,
  rateClientBug,
  reopenClientFix,
  resumeAfterClientReply,
} from "../work/bug-workflow-client";
import {
  conflict,
  decodeBugWorkflowStatus,
  forbidden,
  updateBugStatus,
  writeActivity,
} from "../work/bug-workflow-internal";
import { announceClientBug } from "../work/bug-workflow-pick";
import type { Transaction } from "../work/work-internal";
import { databaseError, validateInput } from "../work/work-internal";
import type {
  AttachClientFileInput,
  ClientBugVersionInput,
  ClientCommentInput,
  ConfirmClientFixInput,
  EditClientBugInput,
  ListCompanyBugsInput,
  PortalActor,
  PortalBugDetail,
  PortalBugReceipt,
  PortalBugSummary,
  PortalComment,
  PortalNotificationList,
  PortalProject,
  RateClientBugInput,
  ReopenClientFixInput,
  SubmitClientBugInput,
} from "./portal-contracts";
import { PortalBugs } from "./portal-contracts";

// A client's impact choice seeds the severity until a handler triages it.
const severityForImpact = {
  high: "critical",
  low: "minor",
  medium: "major",
  urgent: "blocker",
} as const;

const ARCHIVED_OR_CLOSED = new Set(["closed", "duplicate", "withdrawn"]);
const PREVIEW_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const portalError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  const mapped = databaseError(error);
  return mapped.code === "CONFLICT"
    ? mapped
    : new AppError({
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
      });
};

const notFound = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "The bug report was not found.",
  });

const trimmedOrNull = (value: string | null): string | null =>
  value?.trim() ? value.trim() : null;

// A bug of the actor's own company. Another company's bug is reported as
// missing so its existence is never confirmed.
const loadCompanyBug = async (
  transaction: Transaction,
  actor: PortalActor,
  bugId: string
) => {
  const bug = await transaction.orm.public.BugReport.where({
    clientCompanyId: actor.clientCompanyId,
    id: bugId,
  }).first();
  if (!bug) {
    throw notFound();
  }
  const [task, project] = await Promise.all([
    transaction.orm.public.Task.where({ id: bug.taskId }).first(),
    transaction.orm.public.Project.where({ id: bug.projectId }).first(),
  ]);
  if (!task || !project || task.archivedAt) {
    throw notFound();
  }
  return { bug, project, task };
};

const run = <Output>(
  operation: (transaction: Transaction) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: portalError,
    try: () => db.transaction(operation),
  });

const listProjects = (
  actor: PortalActor
): Effect.Effect<readonly PortalProject[], AppError> =>
  run(async (transaction) => {
    const links = await transaction.orm.public.ClientCompanyProject.where({
      companyId: actor.clientCompanyId,
      removedAt: null,
    })
      .select("projectId")
      .all();
    if (links.length === 0) {
      return [];
    }
    const projects = await transaction.orm.public.Project.where((project) =>
      and(
        project.id.in(links.map(({ projectId }) => projectId)),
        project.archivedAt.isNull()
      )
    )
      .orderBy((project) => project.name.asc())
      .all();
    return projects.map(({ id, key, name }) => ({ id, key, name }));
  });

const listBugs = (
  actor: PortalActor,
  input: ListCompanyBugsInput
): Effect.Effect<readonly PortalBugSummary[], AppError> =>
  run(async (transaction) => {
    const statuses = input.status ? [...internalStatusesFor(input.status)] : [];
    const bugs = await transaction.orm.public.BugReport.where((bug) =>
      and(
        bug.clientCompanyId.eq(actor.clientCompanyId),
        ...(input.projectId ? [bug.projectId.eq(input.projectId)] : []),
        ...(input.mine ? [bug.reporterId.eq(actor.id)] : []),
        ...(input.status ? [bug.status.in(statuses)] : [])
      )
    )
      .orderBy((bug) => bug.discoveredAt.desc())
      .limit(200)
      .all();
    if (bugs.length === 0) {
      return [];
    }
    const [tasks, projects, reporters] = await Promise.all([
      transaction.orm.public.Task.where((task) =>
        task.id.in(bugs.map(({ taskId }) => taskId))
      ).all(),
      transaction.orm.public.Project.where((project) =>
        project.id.in([...new Set(bugs.map(({ projectId }) => projectId))])
      ).all(),
      transaction.orm.public.User.where((user) =>
        user.id.in([...new Set(bugs.map(({ reporterId }) => reporterId))])
      )
        .select("id", "name")
        .all(),
    ]);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const projectById = new Map(
      projects.map((project) => [project.id, project])
    );
    const reporterById = new Map(reporters.map((user) => [user.id, user.name]));
    return bugs.flatMap((bug) => {
      const task = taskById.get(bug.taskId);
      const project = projectById.get(bug.projectId);
      if (!task || !project || task.archivedAt) {
        return [];
      }
      return [
        {
          createdAt: bug.createdAt.toISOString(),
          id: bug.id,
          impact: bug.clientImpact,
          isMine: bug.reporterId === actor.id,
          key: `${project.key}-${task.projectTaskNumber}`,
          projectId: project.id,
          projectName: project.name,
          reporterName: reporterById.get(bug.reporterId) ?? "A colleague",
          status: clientStatusLabel(
            decodeBugWorkflowStatus(bug.status),
            bug.resolution
          ),
          title: task.title,
          updatedAt: bug.updatedAt.toISOString(),
        },
      ];
    });
  });

const timelineActions = ["bug.reported", "bug.status_changed"];

const CLOSED_REASONS = new Set([
  "confirmed",
  "unconfirmed",
  "no_response",
  "not_a_bug",
]);

// What the client can do next, and why a finished bug is finished.
const buildLifecycle = async (
  transaction: Transaction,
  actor: PortalActor,
  bug: Awaited<ReturnType<typeof loadCompanyBug>>["bug"],
  teamComments: readonly { readonly body: string; readonly isTeam: boolean }[]
): Promise<PortalBugDetail["lifecycle"]> => {
  const status = decodeBugWorkflowStatus(bug.status);
  const relation = await transaction.orm.public.BugRelation.where({
    fromBugReportId: bug.id,
    type: "duplicate",
  }).first();
  let duplicateOf: PortalBugDetail["lifecycle"]["duplicateOf"] = null;
  if (relation) {
    const original = await transaction.orm.public.BugReport.where({
      id: relation.toBugReportId,
    }).first();
    if (original) {
      const label = clientStatusLabel(
        decodeBugWorkflowStatus(original.status),
        original.resolution
      );
      // Only a bug from the same company shows its title; anything else is
      // reported by status alone.
      let key: string | null = null;
      let title: string | null = null;
      if (original.clientCompanyId === actor.clientCompanyId) {
        const [task, project] = await Promise.all([
          transaction.orm.public.Task.where({ id: original.taskId }).first(),
          transaction.orm.public.Project.where({
            id: original.projectId,
          }).first(),
        ]);
        if (task && project) {
          key = `${project.key}-${task.projectTaskNumber}`;
          ({ title } = task);
        }
      }
      duplicateOf = { key, status: label, title };
    }
  }
  const { needsInfoSince: askedAt } = bug;
  const lastTeamReply = teamComments.findLast(({ isTeam }) => isTeam);
  const reopensLeft = Math.max(0, CLIENT_REOPEN_LIMIT - bug.clientReopenCount);
  return {
    canRate:
      status === "closed" &&
      bug.resolution === "confirmed" &&
      bug.satisfaction === null,
    canReportAgain: status === "closed",
    closedReason:
      status === "closed" &&
      bug.resolution &&
      CLOSED_REASONS.has(bug.resolution)
        ? (bug.resolution as
            | "confirmed"
            | "unconfirmed"
            | "no_response"
            | "not_a_bug")
        : null,
    duplicateOf,
    question:
      status === "needs_info" && askedAt
        ? {
            askedAt: askedAt.toISOString(),
            text: lastTeamReply?.body ?? null,
          }
        : null,
    rating: bug.satisfaction
      ? {
          comment: bug.satisfactionComment,
          satisfaction: bug.satisfaction,
        }
      : null,
    verification:
      status === "awaiting_client" && bug.awaitingClientSince
        ? {
            canReopen: reopensLeft > 0,
            reopensLeft,
            since: bug.awaitingClientSince.toISOString(),
          }
        : null,
  };
};

const getBug = (
  actor: PortalActor,
  bugId: string
): Effect.Effect<PortalBugDetail, AppError> =>
  run(async (transaction) => {
    const { bug, project, task } = await loadCompanyBug(
      transaction,
      actor,
      bugId
    );
    const [comments, evidence, activities, reporter] = await Promise.all([
      transaction.orm.public.Comment.include("author")
        .where({ deletedAt: null, taskId: task.id, visibility: "public" })
        .orderBy((comment) => comment.createdAt.asc())
        .limit(200)
        .all(),
      transaction.orm.public.BugEvidence.where((row) =>
        and(row.bugReportId.eq(bug.id), row.fileAssetId.isNotNull())
      )
        .orderBy((row) => row.createdAt.asc())
        .all(),
      transaction.orm.public.Activity.where((activity) =>
        and(activity.taskId.eq(task.id), activity.action.in(timelineActions))
      )
        .orderBy((activity) => activity.createdAt.asc())
        .limit(200)
        .all(),
      transaction.orm.public.User.where({ id: bug.reporterId })
        .select("name")
        .first(),
    ]);
    const fileIds = evidence.flatMap(({ fileAssetId }) =>
      fileAssetId ? [fileAssetId] : []
    );
    const files =
      fileIds.length === 0
        ? []
        : await transaction.orm.public.FileAsset.include("uploadedBy")
            .where((file) => and(file.id.in(fileIds), file.deletedAt.isNull()))
            .all();
    // Only what client-company users attached is shown; staff evidence stays
    // internal.
    const attachments = files.flatMap((file) =>
      file.copyState === "ready" &&
      file.uploadedBy.clientCompanyId === actor.clientCompanyId
        ? [
            {
              contentType: file.contentType ?? "application/octet-stream",
              createdAt: file.createdAt.toISOString(),
              fileId: file.id,
              fileName: file.originalName,
              previewable: PREVIEW_TYPES.has(file.contentType ?? ""),
              sizeBytes: Number(file.sizeBytes),
              uploaderName: file.uploadedBy.name,
            },
          ]
        : []
    );
    const status = decodeBugWorkflowStatus(bug.status);
    const label = clientStatusLabel(status, bug.resolution);
    const timeline: { at: string; status: typeof label }[] = [];
    for (const activity of activities) {
      const details = (activity.details ?? {}) as Record<string, unknown>;
      let next: typeof label | null = null;
      if (activity.action === "bug.reported") {
        next = "submitted";
      } else if (typeof details["to"] === "string") {
        next = clientStatusLabel(decodeBugWorkflowStatus(details["to"]), null);
      }
      // Internal stages that look the same to the client are one entry.
      if (next && timeline.at(-1)?.status !== next) {
        timeline.push({ at: activity.createdAt.toISOString(), status: next });
      }
    }
    const open = !ARCHIVED_OR_CLOSED.has(status);
    const isReporter = bug.reporterId === actor.id;
    const lifecycle = await buildLifecycle(
      transaction,
      actor,
      bug,
      comments.map((comment) => ({
        body: comment.body,
        isTeam: comment.author.role !== "client",
      }))
    );
    return {
      actualBehavior: bug.actualBehavior,
      attachments,
      browser: bug.browser,
      canAttach: open,
      canComment: open,
      canEdit: isReporter && status === "reported",
      canWithdraw: isReporter && status === "reported",
      comments: comments.map((comment) => ({
        authorName: comment.author.name,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        id: comment.id,
        isMine: comment.authorId === actor.id,
        isTeam: comment.author.role !== "client",
      })),
      createdAt: bug.createdAt.toISOString(),
      description: bug.description,
      device: bug.device,
      expectedBehavior: bug.expectedBehavior,
      id: bug.id,
      impact: bug.clientImpact,
      isMine: isReporter,
      key: `${project.key}-${task.projectTaskNumber}`,
      lifecycle,
      os: bug.os,
      pageUrl: bug.route,
      projectId: project.id,
      projectName: project.name,
      reporterName: reporter?.name ?? "A colleague",
      reproductionSteps: bug.reproductionSteps,
      status: label,
      timeline,
      title: task.title,
      updatedAt: bug.updatedAt.toISOString(),
      version: bug.version,
    };
  });

const submitBug = (
  actor: PortalActor,
  input: SubmitClientBugInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const link = await transaction.orm.public.ClientCompanyProject.where({
      companyId: actor.clientCompanyId,
      projectId: input.projectId,
      removedAt: null,
    })
      .select("id")
      .first();
    if (!link) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Choose one of your company's projects.",
      });
    }
    const created = await createBugReport(
      transaction,
      actor.id,
      {
        actualBehavior: input.actualBehavior,
        appVersion: null,
        browser: trimmedOrNull(input.browser),
        component: "Client report",
        description: trimmedOrNull(input.description),
        device: trimmedOrNull(input.device),
        discoverySource: "customer_report",
        environment: "production",
        expectedBehavior: input.expectedBehavior,
        os: trimmedOrNull(input.os),
        projectId: input.projectId,
        reproductionSteps: input.reproductionSteps,
        route: input.pageUrl,
        severity: severityForImpact[input.impact],
        title: input.title,
      },
      { clientCompanyId: actor.clientCompanyId, clientImpact: input.impact }
    );
    if (input.recurrenceOfBugId) {
      const earlier = await loadCompanyBug(
        transaction,
        actor,
        input.recurrenceOfBugId
      );
      if (earlier.bug.status !== "closed") {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Only a closed bug can be reported again.",
        });
      }
      await transaction.orm.public.BugRelation.create({
        createdAt: new Date(),
        createdById: actor.id,
        fromBugReportId: created.id,
        id: randomUUID(),
        toBugReportId: earlier.bug.id,
        type: "recurrence",
      });
    }
    await announceClientBug(transaction, {
      bugId: created.id,
      now: new Date(),
      reporterId: actor.id,
    });
    return { bugId: created.id, version: created.version };
  });

const requireReporterWhileSubmitted = (
  actor: PortalActor,
  bug: { readonly reporterId: string; readonly status: string }
): void => {
  if (bug.reporterId !== actor.id) {
    forbidden("Only the person who reported this bug can change it.");
  }
  if (bug.status !== "reported") {
    forbidden("A bug can only be changed while it is still Submitted.");
  }
};

const editBug = (
  actor: PortalActor,
  input: EditClientBugInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const { bug, project, task } = await loadCompanyBug(
      transaction,
      actor,
      input.bugId
    );
    requireReporterWhileSubmitted(actor, bug);
    if (bug.version !== input.expectedVersion) {
      conflict();
    }
    const cleaned = validateInput({
      assigneeIds: [],
      description: trimmedOrNull(input.description),
      dueDate: null,
      priority: "none",
      projectId: project.id,
      title: input.title,
    });
    const now = new Date();
    const version = bug.version + 1;
    const updated = await transaction.orm.public.BugReport.where({
      id: bug.id,
      status: "reported",
      version: bug.version,
    }).updateAndCount({
      actualBehavior: input.actualBehavior.trim(),
      browser: trimmedOrNull(input.browser),
      clientImpact: input.impact,
      description: trimmedOrNull(input.description),
      device: trimmedOrNull(input.device),
      expectedBehavior: input.expectedBehavior.trim(),
      os: trimmedOrNull(input.os),
      reproductionSteps: input.reproductionSteps.map((step) => step.trim()),
      route: input.pageUrl.trim(),
      severity: severityForImpact[input.impact],
      updatedAt: now,
      version,
    });
    if (!updated) {
      conflict();
    }
    const taskUpdated = await transaction.orm.public.Task.where({
      id: task.id,
      version: task.version,
    }).updateAndCount({
      description: cleaned.description,
      title: cleaned.title,
      updatedAt: now,
      version: task.version + 1,
    });
    if (!taskUpdated) {
      conflict();
    }
    await writeActivity(transaction, {
      action: "bug.client_edited",
      actorId: actor.id,
      bugId: bug.id,
      details: {},
      now,
      projectId: project.id,
      taskId: task.id,
    });
    return { bugId: bug.id, version };
  });

const withdrawBug = (
  actor: PortalActor,
  input: ClientBugVersionInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const { bug } = await loadCompanyBug(transaction, actor, input.bugId);
    requireReporterWhileSubmitted(actor, bug);
    if (bug.version !== input.expectedVersion) {
      conflict();
    }
    const receipt = await updateBugStatus(transaction, {
      actorId: actor.id,
      bug,
      details: { withdrawn: true },
      nextStatus: "withdrawn",
      now: new Date(),
    });
    return { bugId: receipt.bugId, version: receipt.version };
  });

const addComment = (
  actor: PortalActor,
  input: ClientCommentInput
): Effect.Effect<PortalComment, AppError> =>
  run(async (transaction) => {
    const { bug, task } = await loadCompanyBug(transaction, actor, input.bugId);
    if (ARCHIVED_OR_CLOSED.has(bug.status)) {
      forbidden("Closed bugs are read only.");
    }
    const created = await createCommentInTransaction(transaction, {
      actorId: actor.id,
      body: input.body,
      taskId: task.id,
      visibility: "public",
    });
    // Answering the team's question puts the bug back to work.
    if (bug.status === "needs_info") {
      await resumeAfterClientReply(transaction, actor.id, bug.id);
    }
    return {
      authorName: actor.name,
      body: created.body,
      createdAt: created.createdAt,
      id: created.id,
      isMine: true,
      isTeam: false,
    };
  });

const confirmFix = (
  actor: PortalActor,
  input: ConfirmClientFixInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const receipt = await confirmClientFix(transaction, actor, input);
    return { bugId: receipt.bugId, version: receipt.version };
  });

const reopenFix = (
  actor: PortalActor,
  input: ReopenClientFixInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const receipt = await reopenClientFix(transaction, actor, input);
    return { bugId: receipt.bugId, version: receipt.version };
  });

const rateBug = (
  actor: PortalActor,
  input: RateClientBugInput
): Effect.Effect<void, AppError> =>
  run((transaction) => rateClientBug(transaction, actor, input));

const attachFile = (
  actor: PortalActor,
  input: AttachClientFileInput
): Effect.Effect<void, AppError> =>
  run(async (transaction) => {
    const { bug, project, task } = await loadCompanyBug(
      transaction,
      actor,
      input.bugId
    );
    if (ARCHIVED_OR_CLOSED.has(bug.status)) {
      forbidden("Closed bugs are read only.");
    }
    const file = await transaction.orm.public.FileAsset.where({
      deletedAt: null,
      id: input.fileId,
      taskId: task.id,
      uploadedById: actor.id,
    }).first();
    if (!file) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The uploaded file was not found.",
      });
    }
    const existing = await transaction.orm.public.BugEvidence.where({
      bugReportId: bug.id,
      fileAssetId: file.id,
    })
      .select("id")
      .first();
    if (existing) {
      return;
    }
    const now = new Date();
    await transaction.orm.public.BugEvidence.create({
      bugReportId: bug.id,
      caption: file.originalName,
      createdAt: now,
      externalUrl: null,
      fileAssetId: file.id,
      fixAttemptId: null,
      id: randomUUID(),
      kind: "other",
      uploadedById: actor.id,
    });
    await writeActivity(transaction, {
      action: "bug.client_attachment_added",
      actorId: actor.id,
      bugId: bug.id,
      details: { fileId: file.id },
      now,
      projectId: project.id,
      taskId: task.id,
    });
  });

const taskIdForBug = (
  actor: PortalActor,
  bugId: string
): Effect.Effect<string, AppError> =>
  run(async (transaction) => {
    const { bug, task } = await loadCompanyBug(transaction, actor, bugId);
    if (ARCHIVED_OR_CLOSED.has(bug.status)) {
      forbidden("Closed bugs are read only.");
    }
    return task.id;
  });

const listNotifications = (
  actor: PortalActor
): Effect.Effect<PortalNotificationList, AppError> =>
  run(async (transaction) => {
    const [notifications, unread] = await Promise.all([
      transaction.orm.public.Notification.where({ userId: actor.id })
        .orderBy((notification) => notification.createdAt.desc())
        .limit(50)
        .all(),
      transaction.orm.public.Notification.where({
        readAt: null,
        userId: actor.id,
      }).aggregate((aggregates) => ({ count: aggregates.count() })),
    ]);
    const taskIds = [
      ...new Set(
        notifications.flatMap(({ taskId }) => (taskId ? [taskId] : []))
      ),
    ];
    const bugs =
      taskIds.length === 0
        ? []
        : await transaction.orm.public.BugReport.where((bug) =>
            and(
              bug.taskId.in(taskIds),
              bug.clientCompanyId.eq(actor.clientCompanyId)
            )
          )
            .select("id", "taskId")
            .all();
    const bugByTask = new Map(bugs.map((bug) => [bug.taskId, bug.id]));
    return {
      items: notifications.flatMap((notification) => {
        let bugId: string | null = null;
        if (notification.taskId) {
          bugId = bugByTask.get(notification.taskId) ?? null;
        }
        // A notification about anything but this company's bugs is not shown.
        if (notification.taskId && !bugId) {
          return [];
        }
        return [
          {
            bugId,
            createdAt: notification.createdAt.toISOString(),
            id: notification.id,
            readAt: notification.readAt?.toISOString() ?? null,
            snippet: notification.snippet,
            text: notification.text,
          },
        ];
      }),
      unreadCount: unread.count,
    };
  });

export const PortalBugsLive = Layer.succeed(
  PortalBugs,
  PortalBugs.of({
    addComment,
    attachFile,
    confirmFix,
    editBug,
    getBug,
    listBugs,
    listNotifications,
    listProjects,
    rateBug,
    reopenFix,
    submitBug,
    taskIdForBug,
    withdrawBug,
  })
);

import { randomUUID } from "node:crypto";

import type { Effect } from "effect";

import { createCommentInTransaction } from "../collaboration/create-comment";
import { AppError } from "../core/action-result";
import { resumeAfterClientReply } from "../work/bug-workflow-client";
import {
  confirmClientFix,
  rateClientBug,
  reopenClientFix,
} from "../work/bug-workflow-client-verify";
import { forbidden, writeActivity } from "../work/bug-workflow-internal";
import {
  ARCHIVED_OR_CLOSED,
  loadWritableCompanyBug,
  run,
} from "./portal-bug-access";
import type {
  PortalActor,
  PortalBugReceipt,
  PortalComment,
} from "./portal-contracts";
import type {
  AttachClientFileInput,
  ClientCommentInput,
  ConfirmClientFixInput,
  RateClientBugInput,
  ReopenClientFixInput,
} from "./portal-input-contracts";

export const addComment = (
  actor: PortalActor,
  input: ClientCommentInput
): Effect.Effect<PortalComment, AppError> =>
  run(async (transaction) => {
    const { bug, task } = await loadWritableCompanyBug(
      transaction,
      actor,
      input.bugId
    );
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

export const confirmFix = (
  actor: PortalActor,
  input: ConfirmClientFixInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    await loadWritableCompanyBug(transaction, actor, input.bugId);
    const receipt = await confirmClientFix(transaction, actor, input);
    return { bugId: receipt.bugId, version: receipt.version };
  });

export const reopenFix = (
  actor: PortalActor,
  input: ReopenClientFixInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    await loadWritableCompanyBug(transaction, actor, input.bugId);
    const receipt = await reopenClientFix(transaction, actor, input);
    return { bugId: receipt.bugId, version: receipt.version };
  });

export const rateBug = (
  actor: PortalActor,
  input: RateClientBugInput
): Effect.Effect<void, AppError> =>
  run(async (transaction) => {
    await loadWritableCompanyBug(transaction, actor, input.bugId);
    await rateClientBug(transaction, actor, input);
  });

export const attachFile = (
  actor: PortalActor,
  input: AttachClientFileInput
): Effect.Effect<void, AppError> =>
  run(async (transaction) => {
    const { bug, project, task } = await loadWritableCompanyBug(
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

export const taskIdForBug = (
  actor: PortalActor,
  bugId: string
): Effect.Effect<string, AppError> =>
  run(async (transaction) => {
    const { bug, task } = await loadWritableCompanyBug(
      transaction,
      actor,
      bugId
    );
    if (ARCHIVED_OR_CLOSED.has(bug.status)) {
      forbidden("Closed bugs are read only.");
    }
    return task.id;
  });

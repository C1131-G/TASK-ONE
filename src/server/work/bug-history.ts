import { or } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { loadClientContext } from "./bug-client-context";
import { loadClientReport } from "./bug-client-report";
import { BugHistorySchema } from "./bug-history-contracts";
import { toBugReportItem } from "./bug-management";
import { databaseError } from "./work-internal";

export { BugHistorySchema } from "./bug-history-contracts";

export class BugHistory extends Context.Service<
  BugHistory,
  {
    readonly get: (
      actorId: string,
      bugId: string
    ) => Effect.Effect<typeof BugHistorySchema.Type, AppError>;
  }
>()("metsys/server/BugHistory") {}

interface StaffCandidate {
  readonly deactivatedAt: Date | null;
  readonly mustChangePassword: boolean;
  readonly role: string;
}

// Signed in, not a client, and past the forced password change, in this order.
const assertStaffActor: <Actor extends StaffCandidate>(
  actor: Actor | null
) => asserts actor is Actor = (actor) => {
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.role === "client") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "This area is only available to workspace members.",
    });
  }
  if (actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
};

const getBugHistory = (
  actorId: string,
  bugId: string
): Promise<typeof BugHistorySchema.Type> => {
  if (!Schema.is(UUIDSchema)(bugId)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "The bug report ID is invalid.",
    });
  }
  return db.transaction(async (transaction) => {
    const actor = await transaction.orm.public.User.where({ id: actorId })
      .select("deactivatedAt", "mustChangePassword", "role")
      .first();
    assertStaffActor(actor);
    const bug = await transaction.orm.public.BugReport.where({
      id: bugId,
    }).first();
    if (!bug) {
      throw new AppError({
        code: "NOT_FOUND",
        message: "The bug report was not found.",
      });
    }
    const [
      task,
      project,
      attempts,
      evidence,
      approvals,
      releases,
      relations,
      assignments,
    ] = await Promise.all([
      transaction.orm.public.Task.where({ id: bug.taskId }).first(),
      transaction.orm.public.Project.where({ id: bug.projectId })
        .select("archivedAt", "id", "key")
        .first(),
      transaction.orm.public.BugFixAttempt.where({ bugReportId: bug.id })
        .orderBy((attempt) => attempt.createdAt.asc())
        .all(),
      transaction.orm.public.BugEvidence.where({ bugReportId: bug.id })
        .orderBy((evidenceRow) => evidenceRow.createdAt.asc())
        .all(),
      transaction.orm.public.BugApproval.where({ bugReportId: bug.id })
        .orderBy((approval) => approval.submittedAt.asc())
        .all(),
      transaction.orm.public.BugRelease.where({ bugReportId: bug.id })
        .orderBy((release) => release.releasedAt.asc())
        .all(),
      transaction.orm.public.BugRelation.where((relation) =>
        or(
          relation.fromBugReportId.eq(bug.id),
          relation.toBugReportId.eq(bug.id)
        )
      ).all(),
      transaction.orm.public.TaskAssignee.include("user")
        .where({ taskId: bug.taskId })
        .all(),
    ]);
    if (!task || !project) {
      throw new AppError({
        code: "UNAVAILABLE",
        message: "The bug history could not be loaded.",
      });
    }
    const fileIds = evidence.flatMap(({ fileAssetId }) =>
      fileAssetId ? [fileAssetId] : []
    );
    const relatedIds = relations.map(({ fromBugReportId, toBugReportId }) =>
      fromBugReportId === bug.id ? toBugReportId : fromBugReportId
    );
    const uploaderIds = [
      ...new Set(evidence.map(({ uploadedById }) => uploadedById)),
    ];
    const [files, uploaders, relatedReports, clientReport, clientContext] =
      await Promise.all([
        fileIds.length
          ? transaction.orm.public.FileAsset.where((file) =>
              file.id.in(fileIds)
            ).all()
          : [],
        uploaderIds.length
          ? transaction.orm.public.User.where((user) => user.id.in(uploaderIds))
              .select("id", "name")
              .all()
          : [],
        relatedIds.length
          ? transaction.orm.public.BugReport.where((other) =>
              other.id.in([...new Set(relatedIds)])
            ).all()
          : [],
        loadClientReport(transaction, { id: actorId, role: actor.role }, bug),
        loadClientContext(transaction, bug.taskId),
      ]);
    const [relatedTasks, relatedProjects] = await Promise.all([
      relatedReports.length
        ? transaction.orm.public.Task.where((otherTask) =>
            otherTask.id.in(relatedReports.map(({ taskId }) => taskId))
          ).all()
        : [],
      relatedReports.length
        ? transaction.orm.public.Project.where((otherProject) =>
            otherProject.id.in(relatedReports.map(({ projectId }) => projectId))
          )
            .select("id", "key")
            .all()
        : [],
    ]);
    const fileById = new Map(files.map((file) => [file.id, file]));
    const uploaderNameById = new Map(
      uploaders.map((user) => [user.id, user.name])
    );
    const taskById = new Map(
      relatedTasks.map((relatedTask) => [relatedTask.id, relatedTask])
    );
    const projectById = new Map(
      relatedProjects.map((relatedProject) => [
        relatedProject.id,
        relatedProject,
      ])
    );
    const relationItems = [];
    for (const relation of relations) {
      const id =
        relation.fromBugReportId === bug.id
          ? relation.toBugReportId
          : relation.fromBugReportId;
      const otherBug = relatedReports.find(
        ({ id: candidateId }) => candidateId === id
      );
      const otherTask = otherBug ? taskById.get(otherBug.taskId) : null;
      const otherProject = otherBug
        ? projectById.get(otherBug.projectId)
        : null;
      if (otherBug && otherTask && otherProject) {
        relationItems.push({
          bug: toBugReportItem(
            { ...otherBug, title: otherTask.title },
            otherProject.key,
            otherTask.projectTaskNumber
          ),
          type: relation.type,
        });
      }
    }
    return Schema.decodeUnknownSync(Schema.toType(BugHistorySchema))({
      approvals: approvals.map((approval) => ({
        comment: approval.comment,
        decidedAt: approval.decidedAt?.toISOString() ?? null,
        decidedById: approval.decidedById,
        id: approval.id,
        rejectionReason: approval.rejectionReason,
        snapshot: approval.snapshot,
        status: approval.status,
        submittedAt: approval.submittedAt.toISOString(),
        submittedById: approval.submittedById,
      })),
      archived: Boolean(task.archivedAt || project.archivedAt),
      assignees: assignments.map(({ user }) => ({
        id: user.id,
        name: user.name,
      })),
      attempts: attempts.map((attempt) => ({
        affectedVersion: attempt.affectedVersion,
        authorId: attempt.authorId,
        commitUrl: attempt.commitUrl,
        createdAt: attempt.createdAt.toISOString(),
        fixSummary: attempt.fixSummary,
        fixedVersion: attempt.fixedVersion,
        id: attempt.id,
        pullRequestUrl: attempt.pullRequestUrl,
        rootCause: attempt.rootCause,
        testedEnvironment: attempt.testedEnvironment,
        testedVersion: attempt.testedVersion,
        verificationNotes: attempt.verificationNotes,
        verificationOutcome: attempt.verificationOutcome,
        verificationSteps: attempt.verificationSteps,
        verifiedAt: attempt.verifiedAt?.toISOString() ?? null,
        verifiedById: attempt.verifiedById,
      })),
      bug: toBugReportItem(
        { ...bug, title: task.title },
        project.key,
        task.projectTaskNumber
      ),
      clientContext,
      clientReport,
      evidence: evidence.map((evidenceRow) => {
        const file = evidenceRow.fileAssetId
          ? fileById.get(evidenceRow.fileAssetId)
          : null;
        return {
          caption: evidenceRow.caption,
          createdAt: evidenceRow.createdAt.toISOString(),
          externalUrl: evidenceRow.externalUrl,
          file: file
            ? {
                contentType: file.contentType,
                id: file.id,
                name: file.originalName,
                sizeBytes: Number(file.sizeBytes),
              }
            : null,
          id: evidenceRow.id,
          kind: evidenceRow.kind,
          uploadedBy: {
            id: evidenceRow.uploadedById,
            name: uploaderNameById.get(evidenceRow.uploadedById) ?? "Unknown",
          },
        };
      }),
      priority: task.priority,
      relations: relationItems,
      releases: releases.map((release) => ({
        checkedAt: release.checkedAt?.toISOString() ?? null,
        environment: release.environment,
        id: release.id,
        postReleaseCheckNotes: release.postReleaseCheckNotes,
        postReleaseCheckPassed: release.postReleaseCheckPassed,
        releasedAt: release.releasedAt.toISOString(),
        releasedById: release.releasedById,
        version: release.version,
      })),
    });
  });
};

export const BugHistoryLive = Layer.succeed(
  BugHistory,
  BugHistory.of({
    get: (actorId, bugId) =>
      Effect.tryPromise({
        catch: databaseError,
        try: () => getBugHistory(actorId, bugId),
      }),
  })
);

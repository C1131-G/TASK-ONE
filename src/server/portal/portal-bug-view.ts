import { clientStatusLabel } from "@/features/portal/client-status";

import { CLIENT_REOPEN_LIMIT } from "../work/bug-workflow-client-support";
import { decodeBugWorkflowStatus } from "../work/bug-workflow-internal";
import type { Transaction } from "../work/work-internal";
import type { loadCompanyBug } from "./portal-bug-access";
import type { PortalActor, PortalBugDetail } from "./portal-contracts";

const PREVIEW_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const clientVisibleAttachments = <
  FileRow extends {
    readonly contentType: string | null;
    readonly copyState: string;
    readonly createdAt: Date;
    readonly id: string;
    readonly originalName: string;
    readonly sizeBytes: number | bigint | { readonly toString: () => string };
    readonly uploadedBy: {
      readonly clientCompanyId: string | null;
      readonly name: string;
    };
  },
>(
  files: readonly FileRow[],
  companyId: string
) =>
  files.flatMap((file) => {
    if (
      file.copyState !== "ready" ||
      file.uploadedBy.clientCompanyId !== companyId
    ) {
      return [];
    }
    return [
      {
        contentType: file.contentType ?? "application/octet-stream",
        createdAt: file.createdAt.toISOString(),
        fileId: file.id,
        fileName: file.originalName,
        previewable: PREVIEW_TYPES.has(file.contentType ?? ""),
        sizeBytes: Number(file.sizeBytes),
        uploaderName: file.uploadedBy.name,
      },
    ];
  });

export const clientTimeline = <
  ActivityRow extends {
    readonly action: string;
    readonly createdAt: Date;
    readonly details: unknown;
  },
>(
  activities: readonly ActivityRow[]
) => {
  const timeline: {
    at: string;
    status: ReturnType<typeof clientStatusLabel>;
  }[] = [];
  for (const activity of activities) {
    const details = (activity.details ?? {}) as Record<string, unknown>;
    let next: ReturnType<typeof clientStatusLabel> | null = null;
    if (activity.action === "bug.reported") {
      next = "submitted";
    } else if (typeof details["to"] === "string") {
      next = clientStatusLabel(
        decodeBugWorkflowStatus(details["to"]),
        details["reason"] === "not_a_bug" ? "not_a_bug" : null
      );
    }
    // Internal stages that look the same to the client are one entry.
    if (next && timeline.at(-1)?.status !== next) {
      timeline.push({ at: activity.createdAt.toISOString(), status: next });
    }
  }
  return timeline;
};

export const timelineActions = ["bug.reported", "bug.status_changed"];

const CLOSED_REASONS = new Set([
  "confirmed",
  "unconfirmed",
  "no_response",
  "not_a_bug",
]);

// What the client can do next, and why a finished bug is finished.
export const buildLifecycle = async (
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
            canRespond: true,
            reopensLeft,
            since: bug.awaitingClientSince.toISOString(),
          }
        : null,
  };
};

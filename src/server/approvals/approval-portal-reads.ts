import type { Effect } from "effect";

import type { AppError } from "../core/action-result";
import { run } from "../portal/portal-bug-access";
import type { PortalActor } from "../portal/portal-contracts";
import type { Transaction } from "../work/work-internal";
import {
  approvalNotFound,
  loadVisibleRequest,
  loadVisibleRequests,
  toApprovalStatus,
} from "./approval-access";
import type {
  PortalApprovalDetail,
  PortalApprovalSummary,
} from "./approval-contracts";

const PREVIEW_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type VisibleRequest = Awaited<
  ReturnType<typeof loadVisibleRequests>
>["requests"][number];

const namesOf = async (
  transaction: Transaction,
  userIds: readonly (string | null)[]
): Promise<Map<string, string>> => {
  const wanted = [...new Set(userIds.flatMap((id) => (id ? [id] : [])))];
  if (wanted.length === 0) {
    return new Map();
  }
  const users = await transaction.orm.public.User.where((user) =>
    user.id.in(wanted)
  )
    .select("id", "name")
    .all();
  return new Map(users.map(({ id, name }) => [id, name]));
};

const toSummary = (
  request: VisibleRequest,
  projects: ReadonlyMap<string, string>,
  names: ReadonlyMap<string, string>,
  fileCount: number
): PortalApprovalSummary => ({
  decidedAt: request.decidedAt?.toISOString() ?? null,
  fileCount,
  id: request.id,
  projectName: projects.get(request.projectId) ?? "",
  requestedAt: request.requestedAt.toISOString(),
  requestedByName: names.get(request.requestedById) ?? "",
  status: toApprovalStatus(request.status),
  subjectKind: request.taskId ? "task" : "milestone",
  subjectTitle: request.subjectTitle,
  version: request.version,
});

// Waiting requests first, then the most recent.
const byPriority = (first: VisibleRequest, second: VisibleRequest): number => {
  const firstPending = first.status === "pending" ? 0 : 1;
  const secondPending = second.status === "pending" ? 0 : 1;
  return (
    firstPending - secondPending ||
    second.requestedAt.getTime() - first.requestedAt.getTime()
  );
};

export const listApprovals = (
  actor: PortalActor
): Effect.Effect<readonly PortalApprovalSummary[], AppError> =>
  run(async (transaction) => {
    const { projects, requests } = await loadVisibleRequests(
      transaction,
      actor.clientCompanyId
    );
    if (requests.length === 0) {
      return [];
    }
    const [names, files] = await Promise.all([
      namesOf(
        transaction,
        requests.map(({ requestedById }) => requestedById)
      ),
      transaction.orm.public.ApprovalRequestFile.include("file")
        .where((attached) =>
          attached.requestId.in(requests.map(({ id }) => id))
        )
        .all(),
    ]);
    return requests
      .toSorted(byPriority)
      .map((request) =>
        toSummary(
          request,
          projects,
          names,
          files.filter(
            ({ file, requestId }) => requestId === request.id && !file.deletedAt
          ).length
        )
      );
  });

export const pendingCount = (
  actor: PortalActor
): Effect.Effect<number, AppError> =>
  run(async (transaction) => {
    const { requests } = await loadVisibleRequests(
      transaction,
      actor.clientCompanyId
    );
    return requests.filter(({ status }) => status === "pending").length;
  });

export const getApproval = (
  actor: PortalActor,
  approvalId: string
): Effect.Effect<PortalApprovalDetail, AppError> =>
  run(async (transaction) => {
    const found = await loadVisibleRequest(
      transaction,
      actor.clientCompanyId,
      approvalId
    );
    if (!found) {
      throw approvalNotFound();
    }
    const [{ projects, requests }, listed] = await Promise.all([
      loadVisibleRequests(transaction, actor.clientCompanyId, {
        subjectKey: found.subjectKey,
      }),
      transaction.orm.public.ApprovalRequestFile.include("file")
        .where({ requestId: found.id })
        .all(),
    ]);
    // A file removed after it was attached is gone for the client too.
    const attached = listed.filter(({ file }) => !file.deletedAt);
    const names = await namesOf(
      transaction,
      requests.flatMap(({ decidedById, requestedById }) => [
        decidedById,
        requestedById,
      ])
    );
    const decidedByName = found.decidedById
      ? (names.get(found.decidedById) ?? null)
      : null;
    return {
      ...toSummary(found, projects, names, attached.length),
      canDecide: found.status === "pending",
      decidedByName,
      decisionComment: found.decisionComment,
      files: attached.map(({ file }) => ({
        contentType: file.contentType ?? "application/octet-stream",
        fileId: file.id,
        fileName: file.originalName,
        previewable: PREVIEW_TYPES.has(file.contentType ?? ""),
        sizeBytes: Number(file.sizeBytes),
      })),
      history: requests
        .filter(({ id }) => id !== found.id)
        .toSorted((first, second) => first.version - second.version)
        .map((request) => ({
          decidedAt: request.decidedAt?.toISOString() ?? null,
          decidedByName: request.decidedById
            ? (names.get(request.decidedById) ?? null)
            : null,
          decisionComment: request.decisionComment,
          id: request.id,
          requestedAt: request.requestedAt.toISOString(),
          status: toApprovalStatus(request.status),
          version: request.version,
        })),
      message: found.message,
    };
  });

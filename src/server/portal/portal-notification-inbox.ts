import { and } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";

import { loadVisibleRequests } from "../approvals/approval-access";
import { approvalLinksFor } from "../approvals/approval-notification-links";
import type { AppError } from "../core/action-result";
import type { Transaction } from "../work/work-internal";
import { run } from "./portal-bug-access";
import type { PortalActor, PortalNotificationList } from "./portal-contracts";

const INBOX_LIMIT = 50;

interface NotificationRow {
  readonly actorId: string | null;
  readonly createdAt: Date;
  readonly id: string;
  readonly projectId: string | null;
  readonly readAt: Date | null;
  readonly snippet: string | null;
  readonly targetId: string | null;
  readonly targetType: string | null;
  readonly taskId: string | null;
  readonly text: string;
  readonly type: string;
}

interface VisibleTarget {
  readonly approvalId: string | null;
  readonly bugId: string | null;
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

const bugIdsFor = (rows: readonly NotificationRow[]): string[] =>
  unique(
    rows.flatMap(({ targetId, targetType }) =>
      targetType === "bug" && targetId ? [targetId] : []
    )
  );

// A task target and a legacy row both need the bug the task belongs to, if
// this company has one. An internal task yields nothing.
const taskIdsFor = (rows: readonly NotificationRow[]): string[] =>
  unique(
    rows.flatMap(({ targetId, targetType, taskId }) => {
      if (targetType === "task" && targetId) {
        return [targetId];
      }
      return targetType === null && taskId ? [taskId] : [];
    })
  );

const approvalIdsFor = (rows: readonly NotificationRow[]): string[] =>
  unique(
    rows.flatMap(({ targetId, targetType }) =>
      targetType === "approval" && targetId ? [targetId] : []
    )
  );

// Every row is re-authorized against the caller's company: a bug must still
// belong to it, a task must still resolve to one of its bugs, and a request
// must still be visible. A row whose target cannot be opened is left out, so
// a client never sees a notification that leads nowhere.
const resolveVisibleTargets = async (
  transaction: Transaction,
  companyId: string,
  rows: readonly NotificationRow[]
): Promise<ReadonlyMap<string, VisibleTarget>> => {
  const bugIds = bugIdsFor(rows);
  const taskIds = taskIdsFor(rows);
  const approvalIds = approvalIdsFor(rows);
  const directBugs =
    bugIds.length === 0
      ? []
      : await transaction.orm.public.BugReport.where((bug) =>
          and(bug.id.in(bugIds), bug.clientCompanyId.eq(companyId))
        )
          .select("id")
          .all();
  const taskBugs =
    taskIds.length === 0
      ? []
      : await transaction.orm.public.BugReport.where((bug) =>
          and(bug.taskId.in(taskIds), bug.clientCompanyId.eq(companyId))
        )
          .select("id", "taskId")
          .all();
  const visibleApprovals = new Set<string>();
  if (approvalIds.length > 0) {
    const visible = await loadVisibleRequests(transaction, companyId, {
      ids: approvalIds,
    });
    for (const { id } of visible.requests) {
      visibleApprovals.add(id);
    }
  }
  const legacyApprovals = await approvalLinksFor(transaction, companyId, rows);

  const visibleBugs = new Set(directBugs.map(({ id }) => id));
  const bugByTask = new Map(taskBugs.map(({ id, taskId }) => [taskId, id]));
  const targets = new Map<string, VisibleTarget>();
  for (const row of rows) {
    if (row.targetType === "bug") {
      if (row.targetId && visibleBugs.has(row.targetId)) {
        targets.set(row.id, { approvalId: null, bugId: row.targetId });
      }
      continue;
    }
    if (row.targetType === "task") {
      const bugId = row.targetId ? bugByTask.get(row.targetId) : undefined;
      if (bugId) {
        targets.set(row.id, { approvalId: null, bugId });
      }
      continue;
    }
    if (row.targetType === "approval") {
      if (row.targetId && visibleApprovals.has(row.targetId)) {
        targets.set(row.id, { approvalId: row.targetId, bugId: null });
      }
      continue;
    }
    // Rows written before targets existed keep the old derivation: a bug of
    // this company's, then an approval request matched by what it was written
    // from. Anything else is dropped.
    const bugId = row.taskId ? bugByTask.get(row.taskId) : undefined;
    if (bugId) {
      targets.set(row.id, { approvalId: null, bugId });
      continue;
    }
    const approvalId = legacyApprovals.get(row.id);
    if (approvalId) {
      targets.set(row.id, { approvalId, bugId: null });
    }
  }
  return targets;
};

// The client's own inbox. The web portal keeps its historical list; this read
// adds the per-row target check and counts only the rows it would return.
export const listPortalNotificationInbox = (
  actor: PortalActor
): Effect.Effect<PortalNotificationList, AppError> =>
  run(async (transaction) => {
    const [recent, unread] = await Promise.all([
      transaction.orm.public.Notification.where({ userId: actor.id })
        .orderBy((notification) => notification.createdAt.desc())
        .limit(INBOX_LIMIT)
        .all(),
      transaction.orm.public.Notification.where({
        readAt: null,
        userId: actor.id,
      }).all(),
    ]);
    // An unread row older than the newest page still counts, so both sets are
    // resolved in one pass.
    const rows = new Map<string, NotificationRow>();
    for (const row of [...recent, ...unread]) {
      rows.set(row.id, row);
    }
    const targets = await resolveVisibleTargets(
      transaction,
      actor.clientCompanyId,
      [...rows.values()]
    );
    return {
      items: recent.flatMap((row) => {
        const target = targets.get(row.id);
        if (!target) {
          return [];
        }
        return [
          {
            approvalId: target.approvalId,
            bugId: target.bugId,
            createdAt: row.createdAt.toISOString(),
            id: row.id,
            readAt: row.readAt?.toISOString() ?? null,
            snippet: row.snippet,
            text: row.text,
          },
        ];
      }),
      unreadCount: unread.filter(({ id }) => targets.has(id)).length,
    };
  });

import { and, or } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";

import { loadVisibleRequests } from "../approvals/approval-access";
import { approvalLinksFor } from "../approvals/approval-notification-links";
import type { AppError } from "../core/action-result";
import type { InboxCursor } from "../notifications/inbox-cursor";
import {
  decodeInboxCursor,
  encodeInboxCursor,
} from "../notifications/inbox-cursor";
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

// Rows read per step while looking for a page's worth of openable ones.
const SCAN_BATCH = 100;

export interface PortalInboxOptions {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

export interface PortalInboxPage extends PortalNotificationList {
  readonly nextCursor: string | null;
}

const toItem = (row: NotificationRow, target: VisibleTarget) => ({
  approvalId: target.approvalId,
  bugId: target.bugId,
  createdAt: row.createdAt.toISOString(),
  id: row.id,
  readAt: row.readAt?.toISOString() ?? null,
  snippet: row.snippet,
  text: row.text,
});

// Rows strictly after a position in the newest-first order, with the id as the
// tie-breaker, so a page never repeats or skips a row that shares a timestamp.
const rowsAfter = (
  transaction: Transaction,
  userId: string,
  after: InboxCursor | null,
  count: number
) =>
  transaction.orm.public.Notification.where({ userId })
    .where((notification) =>
      after
        ? or(
            notification.createdAt.lt(after.createdAt),
            and(
              notification.createdAt.eq(after.createdAt),
              notification.id.lt(after.id)
            )
          )
        : notification.id.isNotNull()
    )
    .orderBy([
      (notification) => notification.createdAt.desc(),
      (notification) => notification.id.desc(),
    ])
    .limit(count)
    .all();

// The client's own inbox, one page at a time. Rows whose target the client can
// no longer open are left out, so the page is filled by reading on until it has
// enough openable rows or the list ends. The unread count covers every unread
// row the client could open, not just this page.
export const listPortalNotificationInbox = (
  actor: PortalActor,
  options: PortalInboxOptions = {}
): Effect.Effect<PortalInboxPage, AppError> =>
  run(async (transaction) => {
    const limit = options.limit ?? INBOX_LIMIT;
    let after = options.cursor ? decodeInboxCursor(options.cursor) : null;
    const items: ReturnType<typeof toItem>[] = [];
    let lastScanned: NotificationRow | null = null;
    while (items.length < limit) {
      // eslint-disable-next-line no-await-in-loop
      const batch = await rowsAfter(transaction, actor.id, after, SCAN_BATCH);
      if (batch.length === 0) {
        break;
      }
      // eslint-disable-next-line no-await-in-loop
      const targets = await resolveVisibleTargets(
        transaction,
        actor.clientCompanyId,
        batch
      );
      for (const row of batch) {
        lastScanned = row;
        const target = targets.get(row.id);
        if (target) {
          items.push(toItem(row, target));
        }
        if (items.length === limit) {
          break;
        }
      }
      if (batch.length < SCAN_BATCH) {
        break;
      }
      after = {
        createdAt: batch.at(-1)?.createdAt ?? new Date(),
        id: batch.at(-1)?.id ?? "",
      };
    }
    // A cursor only when something is left to read after the last row scanned.
    const more =
      items.length === limit && lastScanned
        ? await rowsAfter(
            transaction,
            actor.id,
            { createdAt: lastScanned.createdAt, id: lastScanned.id },
            1
          )
        : [];
    const unread = await transaction.orm.public.Notification.where({
      readAt: null,
      userId: actor.id,
    }).all();
    const unreadTargets = await resolveVisibleTargets(
      transaction,
      actor.clientCompanyId,
      unread
    );
    return {
      items,
      nextCursor:
        more.length > 0 && lastScanned
          ? encodeInboxCursor({
              createdAt: lastScanned.createdAt,
              id: lastScanned.id,
            })
          : null,
      unreadCount: unread.filter(({ id }) => unreadTargets.has(id)).length,
    };
  });

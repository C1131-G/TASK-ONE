import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { PortalApprovals } from "../../approvals/portal-approvals-service";
import type { WorkspaceUser } from "../../auth/session-types";
import { AppError } from "../../core/action-result";
import { PortalBugs } from "../../portal/portal-contracts";
import type { PortalActor } from "../../portal/portal-contracts";
import { BugHistory } from "../../work/bug-history";
import { getTaskContext } from "../../work/work-task-context";

export interface OpenedTarget {
  readonly id: string;
  readonly summary: { readonly status: string; readonly title: string };
  readonly type: "task" | "bug" | "approval";
}

// "Not yours" and "no access any more" share one answer, so a notification id
// never confirms that something exists.
const cannotOpen = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "That notification cannot be opened.",
  });

const loadTarget = (userId: string, notificationId: string) =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The notification could not be opened.",
      }),
    try: () =>
      db.orm.public.Notification.where({ id: notificationId, userId })
        .select("targetId", "targetType")
        .first(),
  }).pipe(
    Effect.flatMap((row) =>
      row?.targetId && row.targetType
        ? Effect.succeed({ id: row.targetId, type: row.targetType })
        : Effect.fail(cannotOpen())
    )
  );

const refusals = new Set(["FORBIDDEN", "NOT_FOUND"]);

const sameAnswer = <Value, Requirements>(
  effect: Effect.Effect<Value, AppError, Requirements>
) =>
  effect.pipe(
    Effect.mapError((failure) =>
      refusals.has(failure.code) ? cannotOpen() : failure
    )
  );

const openBug = (actor: PortalActor, bugId: string) =>
  Effect.gen(function* openPortalBug() {
    const bugs = yield* PortalBugs;
    const bug = yield* bugs.getBug(actor, bugId);
    return {
      id: bug.id,
      summary: { status: bug.status, title: bug.title },
      type: "bug" as const,
    };
  });

const openApproval = (actor: PortalActor, approvalId: string) =>
  Effect.gen(function* openPortalApproval() {
    const approvals = yield* PortalApprovals;
    const approval = yield* approvals.get(actor, approvalId);
    return {
      id: approval.id,
      summary: { status: approval.status, title: approval.subjectTitle },
      type: "approval" as const,
    };
  });

// A client opens bugs and requests only. A task target means the bug that
// belongs to that task in this company, and an internal task has none.
const bugOfTask = (actor: PortalActor, taskId: string) =>
  Effect.tryPromise({
    catch: () =>
      new AppError({
        code: "UNAVAILABLE",
        message: "The notification could not be opened.",
      }),
    try: () =>
      db.orm.public.BugReport.where({
        clientCompanyId: actor.clientCompanyId,
        taskId,
      })
        .select("id")
        .first(),
  }).pipe(
    Effect.flatMap((bug) =>
      bug ? Effect.succeed(bug.id) : Effect.fail(cannotOpen())
    )
  );

// Opening re-runs the readers the portal itself uses, so a bug or request the
// company can no longer see is refused exactly as it would be on its screen.
export const openPortalTarget = (actor: PortalActor, notificationId: string) =>
  Effect.gen(function* open() {
    const target = yield* loadTarget(actor.id, notificationId);
    if (target.type === "approval") {
      return yield* sameAnswer(openApproval(actor, target.id));
    }
    const bugId =
      target.type === "task" ? yield* bugOfTask(actor, target.id) : target.id;
    return yield* sameAnswer(openBug(actor, bugId));
  });

const openTask = (user: WorkspaceUser, taskId: string) =>
  Effect.gen(function* openWorkspaceTask() {
    const task = yield* getTaskContext(user, taskId);
    if (task.isArchived) {
      return yield* cannotOpen();
    }
    return {
      id: task.id,
      summary: { status: task.status, title: task.title },
      type: "task" as const,
    };
  });

const openStaffBug = (user: WorkspaceUser, bugId: string) =>
  Effect.gen(function* openWorkspaceBug() {
    const history = yield* BugHistory;
    const { archived, bug } = yield* history.get(user.id, bugId);
    if (archived) {
      return yield* cannotOpen();
    }
    return {
      id: bug.id,
      summary: { status: bug.status, title: bug.title },
      type: "bug" as const,
    };
  });

// Staff open tasks and bugs through the readers their own screens use. They
// have no screen for an approval request, so one is never opened here.
export const openWorkspaceTarget = (
  user: WorkspaceUser,
  notificationId: string
) =>
  Effect.gen(function* open() {
    const target = yield* loadTarget(user.id, notificationId);
    if (target.type === "task") {
      return yield* sameAnswer(openTask(user, target.id));
    }
    if (target.type === "bug") {
      return yield* sameAnswer(openStaffBug(user, target.id));
    }
    return yield* cannotOpen();
  });

import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { Transaction } from "./work-internal";
import { databaseError } from "./work-internal";

export interface BugApprovalInboxItem {
  readonly bugTitle: string;
  readonly id: string;
  readonly projectName: string;
  readonly reportedBy: string;
  readonly status: "pending" | "approved" | "rejected";
}

const list = async (
  transaction: Transaction
): Promise<readonly BugApprovalInboxItem[]> => {
  // Newest first: the inbox shows the latest submission on top.
  const approvals = await transaction.orm.public.BugApproval.orderBy(
    (approval) => approval.submittedAt.desc()
  ).all();
  if (approvals.length === 0) {
    return [];
  }
  const bugIds = [...new Set(approvals.map(({ bugReportId }) => bugReportId))];
  const bugs = await transaction.orm.public.BugReport.where((bug) =>
    bug.id.in(bugIds)
  )
    .select("id", "projectId", "reporterId", "taskId")
    .all();
  const [tasks, projects, reporters] = await Promise.all([
    transaction.orm.public.Task.where((task) =>
      task.id.in([...new Set(bugs.map(({ taskId }) => taskId))])
    )
      .select("id", "title")
      .all(),
    transaction.orm.public.Project.where((project) =>
      project.id.in([...new Set(bugs.map(({ projectId }) => projectId))])
    )
      .select("id", "name")
      .all(),
    transaction.orm.public.User.where((user) =>
      user.id.in([...new Set(bugs.map(({ reporterId }) => reporterId))])
    )
      .select("id", "name")
      .all(),
  ]);
  const bugById = new Map(bugs.map((bug) => [bug.id, bug]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const reporterById = new Map(reporters.map((user) => [user.id, user]));
  const items: BugApprovalInboxItem[] = [];
  for (const approval of approvals) {
    const bug = bugById.get(approval.bugReportId);
    const task = bug ? taskById.get(bug.taskId) : null;
    const project = bug ? projectById.get(bug.projectId) : null;
    const reporter = bug ? reporterById.get(bug.reporterId) : null;
    if (!task || !project || !reporter) {
      continue;
    }
    items.push({
      bugTitle: task.title,
      id: approval.id,
      projectName: project.name,
      reportedBy: reporter.name,
      status: approval.status,
    });
  }
  return items;
};

const listBugApprovals = (
  actorId: string
): Promise<readonly BugApprovalInboxItem[]> =>
  db.transaction(async (transaction) => {
    const actor = await transaction.orm.public.User.where({ id: actorId })
      .select("deactivatedAt", "mustChangePassword", "role")
      .first();
    if (!actor || actor.deactivatedAt) {
      throw new AppError({
        code: "UNAUTHENTICATED",
        message: "Sign in to continue.",
      });
    }
    if (actor.mustChangePassword) {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Change your password before continuing.",
      });
    }
    if (actor.role !== "admin") {
      throw new AppError({
        code: "FORBIDDEN",
        message: "Only admins can see bug approvals.",
      });
    }
    return list(transaction);
  });

export class BugApprovalInbox extends Context.Service<
  BugApprovalInbox,
  {
    readonly list: (
      actorId: string
    ) => Effect.Effect<readonly BugApprovalInboxItem[], AppError>;
  }
>()("metsys/server/BugApprovalInbox") {}

export const BugApprovalInboxLive = Layer.succeed(
  BugApprovalInbox,
  BugApprovalInbox.of({
    list: (actorId) =>
      Effect.tryPromise({
        catch: databaseError,
        try: () => listBugApprovals(actorId),
      }),
  })
);

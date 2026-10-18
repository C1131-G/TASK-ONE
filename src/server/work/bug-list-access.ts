import { and, or } from "@prisma/orm-postgres/orm-client";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

export const ensureBugListAccess = async (
  actorId: string
): Promise<{ readonly role: string }> => {
  const actor = await db.orm.public.User.where({ id: actorId })
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
  if (actor.role === "client") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "This area is only available to workspace members.",
    });
  }
  return { role: actor.role };
};

// Tasks of client reports nobody has picked yet. A handler sees only their
// own companies' reports; an admin sees every company's.
export const findClientQueueTaskIds = async (
  actorId: string,
  role: string
): Promise<string[]> => {
  let companyFilter: string[] | null = null;
  if (role !== "admin") {
    const handled = await db.orm.public.ClientCompanyHandler.where({
      employeeId: actorId,
    })
      .select("companyId")
      .all();
    companyFilter = handled.map(({ companyId }) => companyId);
    if (companyFilter.length === 0) {
      return [];
    }
  }
  const queued = await db.orm.public.BugReport.where((bug) =>
    and(
      bug.clientCompanyId.isNotNull(),
      bug.pickedById.isNull(),
      bug.status.eq("reported"),
      ...(companyFilter ? [bug.clientCompanyId.in(companyFilter)] : [])
    )
  )
    .select("taskId")
    .limit(200)
    .all();
  return queued.map(({ taskId }) => taskId);
};

export const findMatchingTaskIds = async (
  pattern: string
): Promise<string[]> => {
  const [matchingTitles, matchingReports, matchingAttempts] = await Promise.all(
    [
      db.orm.public.Task.where((task) =>
        and(task.type.eq("bug"), task.title.ilike(pattern))
      )
        .select("id")
        .all(),
      db.orm.public.BugReport.where((bug) =>
        or(
          bug.component.ilike(pattern),
          bug.route.ilike(pattern),
          bug.description.ilike(pattern),
          bug.expectedBehavior.ilike(pattern),
          bug.actualBehavior.ilike(pattern)
        )
      )
        .select("id")
        .all(),
      db.orm.public.BugFixAttempt.where((attempt) =>
        or(attempt.rootCause.ilike(pattern), attempt.fixSummary.ilike(pattern))
      )
        .select("bugReportId")
        .all(),
    ]
  );
  const matchingBugIds = [
    ...matchingReports.map(({ id }) => id),
    ...matchingAttempts.map(({ bugReportId }) => bugReportId),
  ];
  const matchingReportsById = matchingBugIds.length
    ? await db.orm.public.BugReport.where((bug) => bug.id.in(matchingBugIds))
        .select("taskId")
        .all()
    : [];
  return [
    ...new Set([
      ...matchingTitles.map(({ id }) => id),
      ...matchingReportsById.map(({ taskId }) => taskId),
    ]),
  ];
};

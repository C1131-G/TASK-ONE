import { and, or } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { BugListInput } from "./bug-contracts";
import { BugListInputSchema } from "./bug-contracts";
import { BugListSchema, toBugReportItem } from "./bug-management-contracts";

export const listBugs = async (
  actorId: string,
  rawInput: BugListInput
): Promise<typeof BugListSchema.Type> => {
  const input = Schema.decodeUnknownSync(BugListInputSchema)(rawInput);
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword")
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

  const pattern = input.query?.trim()
    ? `%${input.query.trim().slice(0, 120)}%`
    : null;
  const [matchingTitles, matchingReports, matchingAttempts, projects] =
    await Promise.all([
      pattern
        ? db.orm.public.Task.where((task) =>
            and(task.type.eq("bug"), task.title.ilike(pattern))
          )
            .select("id")
            .all()
        : [],
      pattern
        ? db.orm.public.BugReport.where((bug) =>
            or(
              bug.component.ilike(pattern),
              bug.route.ilike(pattern),
              bug.description.ilike(pattern),
              bug.expectedBehavior.ilike(pattern),
              bug.actualBehavior.ilike(pattern)
            )
          )
            .select("id")
            .all()
        : [],
      pattern
        ? db.orm.public.BugFixAttempt.where((attempt) =>
            or(
              attempt.rootCause.ilike(pattern),
              attempt.fixSummary.ilike(pattern)
            )
          )
            .select("bugReportId")
            .all()
        : [],
      input.includeArchived
        ? db.orm.public.Project.select("id", "key", "name", "archivedAt").all()
        : db.orm.public.Project.where((project) => project.archivedAt.isNull())
            .select("id", "key", "name", "archivedAt")
            .all(),
    ]);
  const projectById = new Map(projects.map((project) => [project.id, project]));
  let projectIds = [...projectById.keys()];
  if (input.projectId) {
    projectIds = projectById.has(input.projectId) ? [input.projectId] : [];
  }
  if (projectIds.length === 0) {
    return [];
  }

  let taskQuery = db.orm.public.Task.where((task) =>
    and(
      task.type.eq("bug"),
      task.projectId.in(projectIds),
      ...(input.includeArchived ? [] : [task.archivedAt.isNull()])
    )
  );
  if (pattern) {
    const matchingBugIds = [
      ...matchingReports.map(({ id }) => id),
      ...matchingAttempts.map(({ bugReportId }) => bugReportId),
    ];
    const matchingTaskIds = matchingTitles.map(({ id }) => id);
    const matchingBugReports =
      matchingBugIds.length > 0
        ? await db.orm.public.BugReport.where((bug) =>
            bug.id.in(matchingBugIds)
          )
            .select("taskId")
            .all()
        : [];
    const reportTaskIds = matchingBugReports.map(({ taskId }) => taskId);
    const matchingIds = [...new Set([...matchingTaskIds, ...reportTaskIds])];
    if (matchingIds.length === 0) {
      return [];
    }
    taskQuery = taskQuery.where((task) => task.id.in(matchingIds));
  }
  const tasks = await taskQuery
    .orderBy((task) => task.updatedAt.desc())
    .limit(200)
    .all();
  if (tasks.length === 0) {
    return [];
  }
  const taskIds = tasks.map(({ id }) => id);
  let bugQuery = db.orm.public.BugReport.where((bug) => bug.taskId.in(taskIds));
  if (input.status) {
    bugQuery = bugQuery.where({ status: input.status });
  }
  if (input.severity) {
    bugQuery = bugQuery.where({ severity: input.severity });
  }
  const bugs = await bugQuery
    .orderBy((bug) => bug.discoveredAt.desc())
    .limit(200)
    .all();
  const bugIds = bugs.map(({ id }) => id);
  const [assignees, relations, fixAttempts] = await Promise.all([
    db.orm.public.TaskAssignee.where((assignment) =>
      assignment.taskId.in(taskIds)
    )
      .select("taskId", "userId")
      .all(),
    bugIds.length
      ? db.orm.public.BugRelation.where((relation) =>
          or(
            relation.fromBugReportId.in(bugIds),
            relation.toBugReportId.in(bugIds)
          )
        )
          .select("fromBugReportId", "toBugReportId")
          .all()
      : [],
    bugIds.length
      ? db.orm.public.BugFixAttempt.where((attempt) =>
          attempt.bugReportId.in(bugIds)
        )
          .orderBy((attempt) => attempt.createdAt.desc())
          .all()
      : [],
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const assigneesByTask = new Map<string, string[]>();
  for (const assignment of assignees) {
    const ids = assigneesByTask.get(assignment.taskId) ?? [];
    ids.push(assignment.userId);
    assigneesByTask.set(assignment.taskId, ids);
  }
  const relatedByBug = new Map<string, Set<string>>();
  const latestAttemptByBug = new Map<string, (typeof fixAttempts)[number]>();
  const latestVerifiedFixByBug = new Map<
    string,
    (typeof fixAttempts)[number]
  >();
  for (const attempt of fixAttempts) {
    if (!latestAttemptByBug.has(attempt.bugReportId)) {
      latestAttemptByBug.set(attempt.bugReportId, attempt);
    }
    if (
      attempt.verificationOutcome === "passed" &&
      attempt.verifiedAt &&
      !latestVerifiedFixByBug.has(attempt.bugReportId)
    ) {
      latestVerifiedFixByBug.set(attempt.bugReportId, attempt);
    }
  }
  for (const relation of relations) {
    const from =
      relatedByBug.get(relation.fromBugReportId) ?? new Set<string>();
    from.add(relation.toBugReportId);
    relatedByBug.set(relation.fromBugReportId, from);
    const to = relatedByBug.get(relation.toBugReportId) ?? new Set<string>();
    to.add(relation.fromBugReportId);
    relatedByBug.set(relation.toBugReportId, to);
  }
  const rows = [];
  for (const bug of bugs) {
    const task = taskById.get(bug.taskId);
    const project = projectById.get(bug.projectId);
    if (!task || !project) {
      continue;
    }
    rows.push({
      archived: Boolean(task.archivedAt || project.archivedAt),
      assigneeIds: assigneesByTask.get(task.id) ?? [],
      bug: toBugReportItem(
        { ...bug, title: task.title },
        project.key,
        task.projectTaskNumber
      ),
      latestFixOutcome:
        latestAttemptByBug.get(bug.id)?.verificationOutcome ?? null,
      latestFixSummary: latestVerifiedFixByBug.get(bug.id)?.fixSummary ?? null,
      priority: task.priority,
      projectName: project.name,
      relatedBugIds: [...(relatedByBug.get(bug.id) ?? [])],
    });
  }
  return Schema.decodeUnknownSync(Schema.toType(BugListSchema))(rows);
};

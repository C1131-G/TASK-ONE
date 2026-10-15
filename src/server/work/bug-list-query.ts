import { and, or } from "@prisma/orm-postgres/orm-client";
import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { loadSlaSettings } from "../company/sla-settings";
import { AppError } from "../core/action-result";
import type { BugListInput } from "./bug-contracts";
import { BugListInputSchema } from "./bug-contracts";
import { BugListSchema, toBugReportItem } from "./bug-management-contracts";
import { buildSlaView } from "./bug-sla";

const ensureBugListAccess = async (
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
const findClientQueueTaskIds = async (
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

const findMatchingTaskIds = async (pattern: string): Promise<string[]> => {
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

const loadProjects = (includeArchived: boolean) =>
  includeArchived
    ? db.orm.public.Project.select("id", "key", "name", "archivedAt").all()
    : db.orm.public.Project.where((project) => project.archivedAt.isNull())
        .select("id", "key", "name", "archivedAt")
        .all();

type BugProjectMap = Map<
  string,
  Awaited<ReturnType<typeof loadProjects>>[number]
>;

const getProjectMap = async (
  includeArchived: boolean
): Promise<BugProjectMap> => {
  const projects = await loadProjects(includeArchived);
  return new Map(projects.map((project) => [project.id, project]));
};

const loadTasks = (
  projectIds: string[],
  includeArchived: boolean,
  matchingTaskIds: string[] | null
) => {
  if (projectIds.length === 0) {
    return [];
  }
  let taskQuery = db.orm.public.Task.where((task) =>
    and(
      task.type.eq("bug"),
      task.projectId.in(projectIds),
      ...(includeArchived ? [] : [task.archivedAt.isNull()])
    )
  );
  if (matchingTaskIds) {
    if (matchingTaskIds.length === 0) {
      return [];
    }
    taskQuery = taskQuery.where((task) => task.id.in(matchingTaskIds));
  }
  return taskQuery
    .orderBy((task) => task.updatedAt.desc())
    .limit(200)
    .all();
};

type BugTasks = Awaited<ReturnType<typeof loadTasks>>;

const loadBugListRecords = async (tasks: BugTasks, input: BugListInput) => {
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
  const [assignees, relations, fixAttempts, slas, slaSettings] =
    await Promise.all([
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
      bugIds.length
        ? db.orm.public.BugSla.where((sla) => sla.bugId.in(bugIds)).all()
        : [],
      loadSlaSettings(db),
    ]);
  return { assignees, bugs, fixAttempts, relations, slaSettings, slas };
};

type BugListRecords = Awaited<ReturnType<typeof loadBugListRecords>>;

const indexAssignees = (
  assignees: BugListRecords["assignees"]
): Map<string, string[]> => {
  const assigneesByTask = new Map<string, string[]>();
  for (const assignment of assignees) {
    const ids = assigneesByTask.get(assignment.taskId) ?? [];
    ids.push(assignment.userId);
    assigneesByTask.set(assignment.taskId, ids);
  }
  return assigneesByTask;
};

const indexRelations = (
  relations: BugListRecords["relations"]
): Map<string, Set<string>> => {
  const relatedByBug = new Map<string, Set<string>>();
  for (const relation of relations) {
    const relatedFrom = relatedByBug.get(relation.fromBugReportId) ?? new Set();
    relatedFrom.add(relation.toBugReportId);
    relatedByBug.set(relation.fromBugReportId, relatedFrom);
    const relatedTo = relatedByBug.get(relation.toBugReportId) ?? new Set();
    relatedTo.add(relation.fromBugReportId);
    relatedByBug.set(relation.toBugReportId, relatedTo);
  }
  return relatedByBug;
};

const indexFixAttempts = (fixAttempts: BugListRecords["fixAttempts"]) => {
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
  return { latestAttemptByBug, latestVerifiedFixByBug };
};

const toBugListRows = (
  records: BugListRecords,
  tasks: BugTasks,
  projectById: BugProjectMap
): typeof BugListSchema.Type => {
  const slaByBug = new Map(records.slas.map((sla) => [sla.bugId, sla]));
  const slaFor = (bugId: string) => {
    const sla = slaByBug.get(bugId);
    return sla ? buildSlaView(sla, records.slaSettings, new Date()) : null;
  };
  const { latestAttemptByBug, latestVerifiedFixByBug } = indexFixAttempts(
    records.fixAttempts
  );
  const assigneesByTask = indexAssignees(records.assignees);
  const relatedByBug = indexRelations(records.relations);

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const rows = [];
  for (const bug of records.bugs) {
    const task = taskById.get(bug.taskId);
    const project = projectById.get(bug.projectId);
    if (!(task && project)) {
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
      sla: slaFor(bug.id),
    });
  }
  return Schema.decodeUnknownSync(Schema.toType(BugListSchema))(rows);
};

const getBugRows = async (
  tasks: BugTasks,
  projectById: BugProjectMap,
  input: BugListInput
): Promise<typeof BugListSchema.Type> => {
  if (tasks.length === 0) {
    return [];
  }
  const records = await loadBugListRecords(tasks, input);
  return toBugListRows(records, tasks, projectById);
};

export const listBugs = async (
  actorId: string,
  rawInput: BugListInput
): Promise<typeof BugListSchema.Type> => {
  const input = Schema.decodeUnknownSync(BugListInputSchema)(rawInput);
  const actor = await ensureBugListAccess(actorId);
  const pattern = input.query?.trim()
    ? `%${input.query.trim().slice(0, 120)}%`
    : null;
  const includeArchived = input.includeArchived ?? false;
  const [projectById, searchTaskIds, queueTaskIds] = await Promise.all([
    getProjectMap(includeArchived),
    pattern ? findMatchingTaskIds(pattern) : null,
    input.view === "client_queue"
      ? findClientQueueTaskIds(actorId, actor.role)
      : null,
  ]);
  let matchingTaskIds = searchTaskIds;
  if (queueTaskIds) {
    const queued = new Set(queueTaskIds);
    matchingTaskIds = searchTaskIds
      ? searchTaskIds.filter((id) => queued.has(id))
      : queueTaskIds;
  }
  let projectIds = [...projectById.keys()];
  if (input.projectId) {
    projectIds = projectById.has(input.projectId) ? [input.projectId] : [];
  }
  const tasks = await loadTasks(projectIds, includeArchived, matchingTaskIds);
  return getBugRows(tasks, projectById, input);
};

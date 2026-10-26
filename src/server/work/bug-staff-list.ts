import { or } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { loadSlaSettings } from "../company/sla-settings";
import { ensureBugListAccess } from "./bug-list-access";
import { buildSlaView } from "./bug-sla";
import { databaseError } from "./work-internal";

const DEFAULT_PAGE_SIZE = 30;

export interface StaffBugListInput {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly status?: string | undefined;
}

type Scope =
  | "all"
  | "none"
  | { readonly companyIds: string[]; readonly taskIds: string[] };

// An admin sees every bug. An employee sees the bugs of the companies they are
// a designated handler of and the bugs they are assigned to.
const visibilityScope = async (
  actorId: string,
  role: string
): Promise<Scope> => {
  if (role === "admin") {
    return "all";
  }
  const [handled, assigned] = await Promise.all([
    db.orm.public.ClientCompanyHandler.where({ employeeId: actorId })
      .select("companyId")
      .all(),
    db.orm.public.TaskAssignee.where({ userId: actorId })
      .select("taskId")
      .all(),
  ]);
  if (handled.length === 0 && assigned.length === 0) {
    return "none";
  }
  return {
    companyIds: handled.map(({ companyId }) => companyId),
    taskIds: assigned.map(({ taskId }) => taskId),
  };
};

const listForStaff = async (actorId: string, input: StaffBugListInput) => {
  const actor = await ensureBugListAccess(actorId);
  const scope = await visibilityScope(actorId, actor.role);
  if (scope === "none") {
    return { items: [], nextCursor: null };
  }
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const bugs = await db.orm.public.BugReport.where((bug) =>
    scope === "all"
      ? bug.id.isNotNull()
      : or(
          ...(scope.taskIds.length ? [bug.taskId.in(scope.taskIds)] : []),
          ...(scope.companyIds.length
            ? [bug.clientCompanyId.in(scope.companyIds)]
            : [])
        )
  )
    .orderBy([(bug) => bug.updatedAt.desc(), (bug) => bug.id.desc()])
    .limit(limit)
    .all();
  const taskIds = bugs.map(({ taskId }) => taskId);
  const [tasks, projects, companies, slas, settings] = await Promise.all([
    db.orm.public.Task.where((task) => task.id.in(taskIds)).all(),
    db.orm.public.Project.select("id", "key").all(),
    db.orm.public.ClientCompany.select("id", "name").all(),
    db.orm.public.BugSla.where((sla) =>
      sla.bugId.in(bugs.map(({ id }) => id))
    ).all(),
    loadSlaSettings(db),
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const projectKey = new Map(projects.map(({ id, key }) => [id, key]));
  const companyName = new Map(companies.map(({ id, name }) => [id, name]));
  const slaByBug = new Map(slas.map((sla) => [sla.bugId, sla]));
  const now = new Date();
  const items = [];
  for (const bug of bugs) {
    const task = taskById.get(bug.taskId);
    if (task) {
      const sla = slaByBug.get(bug.id);
      items.push({
        clientCompanyName: bug.clientCompanyId
          ? (companyName.get(bug.clientCompanyId) ?? null)
          : null,
        id: bug.id,
        permittedActions: [],
        priority: task.priority,
        reference: `${projectKey.get(bug.projectId) ?? ""}-${task.projectTaskNumber}`,
        severity: bug.severity,
        sla: sla ? buildSlaView(sla, settings, now) : null,
        status: bug.status,
        title: task.title,
        updatedAt: bug.updatedAt.toISOString(),
        version: bug.version,
      });
    }
  }
  return { items, nextCursor: null };
};

export const listStaffBugs = (actorId: string, input: StaffBugListInput) =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => listForStaff(actorId, input),
  });

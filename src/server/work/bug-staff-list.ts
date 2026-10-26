import { and, not, or } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { loadSlaSettings } from "../company/sla-settings";
import {
  decodeInboxCursor,
  encodeInboxCursor,
} from "../notifications/inbox-cursor";
import { clientBugPermissions } from "./bug-client-report";
import type { BugWorkflowStatusSchema } from "./bug-contracts";
import { ensureBugListAccess } from "./bug-list-access";
import { buildSlaView } from "./bug-sla";
import { databaseError } from "./work-internal";

const DEFAULT_PAGE_SIZE = 30;

export interface StaffBugListInput {
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly status?: typeof BugWorkflowStatusSchema.Type | undefined;
}

type BugAction = "comment" | "reply_to_client" | "pick" | "request_info";

interface Involvement {
  readonly handledCompanyIds: ReadonlySet<string>;
  readonly assignedTaskIds: ReadonlySet<string>;
}

// The companies the caller is a designated handler of and the bugs they are
// assigned to: the two ways an employee is involved with a bug.
const loadInvolvement = async (actorId: string): Promise<Involvement> => {
  const [handled, assigned] = await Promise.all([
    db.orm.public.ClientCompanyHandler.where({ employeeId: actorId })
      .select("companyId")
      .all(),
    db.orm.public.TaskAssignee.where({ userId: actorId })
      .select("taskId")
      .all(),
  ]);
  return {
    assignedTaskIds: new Set(assigned.map(({ taskId }) => taskId)),
    handledCompanyIds: new Set(handled.map(({ companyId }) => companyId)),
  };
};

// Archived bugs and the bugs of archived projects are no longer actionable.
const loadArchivedIds = async () => {
  const [tasks, projects] = await Promise.all([
    db.orm.public.Task.where((task) =>
      and(task.type.eq("bug"), task.archivedAt.isNotNull())
    )
      .select("id")
      .all(),
    db.orm.public.Project.where((project) => project.archivedAt.isNotNull())
      .select("id")
      .all(),
  ]);
  return {
    projectIds: projects.map(({ id }) => id),
    taskIds: tasks.map(({ id }) => id),
  };
};

const actionsFor = (
  actor: { readonly role: string },
  involvement: Involvement,
  bug: {
    readonly clientCompanyId: string | null;
    readonly pickedById: string | null;
    readonly status: string;
    readonly taskId: string;
  },
  companyIsActive: boolean
): BugAction[] => {
  if (!bug.clientCompanyId) {
    return ["comment"];
  }
  const permissions = clientBugPermissions({
    companyIsActive,
    isAssigned: involvement.assignedTaskIds.has(bug.taskId),
    isHandler: involvement.handledCompanyIds.has(bug.clientCompanyId),
    pickedById: bug.pickedById,
    role: actor.role,
    status: bug.status,
  });
  const actions: BugAction[] = [];
  if (permissions.canPick) {
    actions.push("pick");
  }
  // Only the handler who works on a client bug, or an admin, may reply.
  if (permissions.canWork) {
    actions.push("comment", "reply_to_client");
  }
  if (permissions.canAskClient) {
    actions.push("request_info");
  }
  return actions;
};

const listForStaff = async (actorId: string, input: StaffBugListInput) => {
  const actor = await ensureBugListAccess(actorId);
  const involvement = await loadInvolvement(actorId);
  const isAdmin = actor.role === "admin";
  const handledIds = [...involvement.handledCompanyIds];
  const assignedIds = [...involvement.assignedTaskIds];
  if (!isAdmin && handledIds.length === 0 && assignedIds.length === 0) {
    return { items: [], nextCursor: null };
  }
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;
  const after = input.cursor ? decodeInboxCursor(input.cursor) : null;
  const hidden = await loadArchivedIds();
  const fetched = await db.orm.public.BugReport.where((bug) =>
    and(
      ...(input.status ? [bug.status.eq(input.status)] : []),
      ...(hidden.taskIds.length ? [not(bug.taskId.in(hidden.taskIds))] : []),
      ...(hidden.projectIds.length
        ? [not(bug.projectId.in(hidden.projectIds))]
        : [])
    )
  )
    .where((bug) =>
      isAdmin
        ? bug.id.isNotNull()
        : or(
            ...(assignedIds.length ? [bug.taskId.in(assignedIds)] : []),
            ...(handledIds.length ? [bug.clientCompanyId.in(handledIds)] : [])
          )
    )
    .where((bug) =>
      after
        ? or(
            bug.updatedAt.lt(after.createdAt),
            and(bug.updatedAt.eq(after.createdAt), bug.id.lt(after.id))
          )
        : bug.id.isNotNull()
    )
    .orderBy([(bug) => bug.updatedAt.desc(), (bug) => bug.id.desc()])
    .limit(limit + 1)
    .all();
  const bugs = fetched.slice(0, limit);
  const last = fetched.length > limit ? bugs.at(-1) : undefined;
  const companyIds = [
    ...new Set(bugs.flatMap(({ clientCompanyId }) => clientCompanyId ?? [])),
  ];
  const [tasks, projects, companies, slas, settings] = await Promise.all([
    db.orm.public.Task.where((task) =>
      task.id.in(bugs.map(({ taskId }) => taskId))
    ).all(),
    db.orm.public.Project.where((project) =>
      project.id.in(bugs.map(({ projectId }) => projectId))
    )
      .select("id", "key")
      .all(),
    companyIds.length
      ? db.orm.public.ClientCompany.where((company) =>
          company.id.in(companyIds)
        )
          .select("deactivatedAt", "id", "name")
          .all()
      : [],
    db.orm.public.BugSla.where((sla) =>
      sla.bugId.in(bugs.map(({ id }) => id))
    ).all(),
    loadSlaSettings(db),
  ]);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const projectKey = new Map(projects.map(({ id, key }) => [id, key]));
  const companyById = new Map(
    companies.map((company) => [company.id, company])
  );
  const slaByBug = new Map(slas.map((sla) => [sla.bugId, sla]));
  const now = new Date();
  const items = [];
  for (const bug of bugs) {
    const task = taskById.get(bug.taskId);
    if (task) {
      const company = bug.clientCompanyId
        ? companyById.get(bug.clientCompanyId)
        : undefined;
      const sla = slaByBug.get(bug.id);
      items.push({
        clientCompanyName: company?.name ?? null,
        id: bug.id,
        permittedActions: actionsFor(
          actor,
          involvement,
          bug,
          company?.deactivatedAt === null
        ),
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
  return {
    items,
    nextCursor: last
      ? encodeInboxCursor({ createdAt: last.updatedAt, id: last.id })
      : null,
  };
};

export const listStaffBugs = (actorId: string, input: StaffBugListInput) =>
  Effect.tryPromise({
    catch: databaseError,
    try: () => listForStaff(actorId, input),
  });

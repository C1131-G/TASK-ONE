import { randomUUID } from "node:crypto";

import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import type {
  BugListInput,
  BugReportInput,
  ClientImpactSchema,
} from "./bug-contracts";
import { BugReportInputSchema } from "./bug-contracts";
import { listBugs } from "./bug-list-query";
import type { BugReportItem, BugListSchema } from "./bug-management-contracts";
import { toBugReportItem } from "./bug-management-contracts";
import type { Transaction } from "./work-internal";
import { databaseError } from "./work-internal";
import { createTaskInTransaction } from "./work-task-creation";

export {
  BugListItemSchema,
  BugListSchema,
  BugReportItemSchema,
  toBugReportItem,
} from "./bug-management-contracts";
export type { BugReportItem } from "./bug-management-contracts";

const getActiveActor = async (
  transaction: Transaction,
  actorId: string
): Promise<void> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
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
};

const getBugInTransaction = async (
  transaction: Transaction,
  bugId: string
): Promise<BugReportItem> => {
  const bug = await transaction.orm.public.BugReport.where({
    id: bugId,
  }).first();
  if (!bug) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The bug report was not found.",
    });
  }
  const [project, task] = await Promise.all([
    transaction.orm.public.Project.where({ id: bug.projectId })
      .select("key")
      .first(),
    transaction.orm.public.Task.where({ id: bug.taskId })
      .select("projectTaskNumber", "title")
      .first(),
  ]);
  if (!project || !task) {
    throw new AppError({
      code: "UNAVAILABLE",
      message: "The bug report could not be loaded.",
    });
  }
  return toBugReportItem(
    { ...bug, title: task.title },
    project.key,
    task.projectTaskNumber
  );
};

export interface ClientReportDetails {
  readonly clientCompanyId: string;
  readonly clientImpact: typeof ClientImpactSchema.Type;
}

// Creates the bug and its task. Client reports carry their company and impact
// so the portal and the handlers' queue can find them.
export const createBugReport = async (
  transaction: Transaction,
  actorId: string,
  rawInput: BugReportInput,
  client?: ClientReportDetails
): Promise<BugReportItem> => {
  const input = Schema.decodeUnknownSync(BugReportInputSchema)(rawInput);
  const title = input.title.trim();
  const component = input.component.trim();
  const route = input.route.trim();
  if (
    !title ||
    !component ||
    !route ||
    !input.reproductionSteps.every((step) => step.trim())
  ) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Complete the title, component, route, and reproduction steps.",
    });
  }
  const task = await createTaskInTransaction(
    transaction,
    actorId,
    {
      assigneeIds: [],
      description: input.description,
      dueDate: null,
      priority: "none",
      projectId: input.projectId,
      title,
    },
    "bug",
    "backlog"
  );
  const now = new Date();
  const id = randomUUID();
  await transaction.orm.public.BugReport.create({
    actualBehavior: input.actualBehavior.trim(),
    appVersion: input.appVersion,
    browser: input.browser,
    clientCompanyId: client?.clientCompanyId ?? null,
    clientImpact: client?.clientImpact ?? null,
    component,
    createdAt: now,
    description: input.description,
    device: input.device,
    discoveredAt: now,
    discoverySource: input.discoverySource,
    environment: input.environment,
    expectedBehavior: input.expectedBehavior.trim(),
    id,
    os: input.os,
    projectId: input.projectId,
    reporterId: actorId,
    reproductionSteps: input.reproductionSteps.map((step) => step.trim()),
    route,
    severity: input.severity,
    status: "reported",
    taskId: task.id,
    updatedAt: now,
    version: 1,
  });
  await transaction.orm.public.Activity.create({
    action: "bug.reported",
    actorId,
    createdAt: now,
    details: {
      bugId: id,
      projectId: input.projectId,
      taskId: task.id,
      ...(client ? { clientCompanyId: client.clientCompanyId } : {}),
    },
    id: randomUUID(),
    projectId: input.projectId,
    taskId: task.id,
  });
  return getBugInTransaction(transaction, id);
};

const getBug = (actorId: string, bugId: string): Promise<BugReportItem> => {
  if (!Schema.is(UUIDSchema)(bugId)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "The bug report ID is invalid.",
    });
  }
  return db.transaction(async (transaction) => {
    await getActiveActor(transaction, actorId);
    return getBugInTransaction(transaction, bugId);
  });
};

export class BugManagement extends Context.Service<
  BugManagement,
  {
    readonly reportBug: (
      actorId: string,
      input: BugReportInput
    ) => Effect.Effect<BugReportItem, AppError>;
    readonly getBug: (
      actorId: string,
      bugId: string
    ) => Effect.Effect<BugReportItem, AppError>;
    readonly listBugs: (
      actorId: string,
      input: BugListInput
    ) => Effect.Effect<typeof BugListSchema.Type, AppError>;
  }
>()("metsys/server/BugManagement") {}

export const BugManagementLive = Layer.succeed(
  BugManagement,
  BugManagement.of({
    getBug: (actorId, bugId) =>
      Effect.tryPromise({
        catch: databaseError,
        try: () => getBug(actorId, bugId),
      }),
    listBugs: (actorId, input) =>
      Effect.tryPromise({
        catch: databaseError,
        try: () => listBugs(actorId, input),
      }),
    reportBug: (actorId, input) =>
      Effect.tryPromise({
        catch: databaseError,
        try: () =>
          db.transaction(async (transaction) => {
            await getActiveActor(transaction, actorId);
            return createBugReport(transaction, actorId, input);
          }),
      }),
  })
);

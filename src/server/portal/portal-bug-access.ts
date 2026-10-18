import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { forbidden } from "../work/bug-workflow-internal";
import type { Transaction } from "../work/work-internal";
import { databaseError } from "../work/work-internal";
import type { PortalActor } from "./portal-contracts";

// A client's impact choice seeds the severity until a handler triages it.
export const severityForImpact = {
  high: "critical",
  low: "minor",
  medium: "major",
  urgent: "blocker",
} as const;

export const ARCHIVED_OR_CLOSED = new Set(["closed", "duplicate", "withdrawn"]);

const portalError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  const mapped = databaseError(error);
  return mapped.code === "CONFLICT"
    ? mapped
    : new AppError({
        code: "UNAVAILABLE",
        message: "The request could not be completed.",
      });
};

const notFound = () =>
  new AppError({
    code: "NOT_FOUND",
    message: "The bug report was not found.",
  });

export const trimmedOrNull = (value: string | null): string | null =>
  value?.trim() ? value.trim() : null;

// A bug of the actor's own company. Another company's bug is reported as
// missing so its existence is never confirmed.
export const loadCompanyBug = async (
  transaction: Transaction,
  actor: PortalActor,
  bugId: string
) => {
  const bug = await transaction.orm.public.BugReport.where({
    clientCompanyId: actor.clientCompanyId,
    id: bugId,
  }).first();
  if (!bug) {
    throw notFound();
  }
  const [task, project] = await Promise.all([
    transaction.orm.public.Task.where({ id: bug.taskId }).first(),
    transaction.orm.public.Project.where({ id: bug.projectId }).first(),
  ]);
  if (!task || !project || task.archivedAt) {
    throw notFound();
  }
  // Once the project is taken off the company, its bugs stay visible but
  // read only.
  const link = await transaction.orm.public.ClientCompanyProject.where({
    companyId: actor.clientCompanyId,
    projectId: bug.projectId,
    removedAt: null,
  })
    .select("id")
    .first();
  return { bug, project, projectLinked: Boolean(link), task };
};

export const PROJECT_REMOVED_MESSAGE =
  "This project is no longer available to your company, so its reports are read only.";

// The same bug, refused when its project was removed from the company.
export const loadWritableCompanyBug = async (
  transaction: Transaction,
  actor: PortalActor,
  bugId: string
) => {
  const loaded = await loadCompanyBug(transaction, actor, bugId);
  if (!loaded.projectLinked) {
    forbidden(PROJECT_REMOVED_MESSAGE);
  }
  return loaded;
};

export const run = <Output>(
  operation: (transaction: Transaction) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: portalError,
    try: () => db.transaction(operation),
  });

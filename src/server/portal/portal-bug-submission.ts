import { randomUUID } from "node:crypto";

import type { Effect } from "effect";

import { AppError } from "../core/action-result";
import { createBugReport } from "../work/bug-management";
import { createBugSla } from "../work/bug-sla";
import {
  conflict,
  forbidden,
  updateBugStatus,
  writeActivity,
} from "../work/bug-workflow-internal";
import { announceClientBug } from "../work/bug-workflow-pick";
import { validateInput } from "../work/work-internal";
import {
  loadCompanyBug,
  loadWritableCompanyBug,
  run,
  severityForImpact,
  trimmedOrNull,
} from "./portal-bug-access";
import type { PortalActor, PortalBugReceipt } from "./portal-contracts";
import type {
  ClientBugVersionInput,
  EditClientBugInput,
  SubmitClientBugInput,
} from "./portal-input-contracts";

export const submitBug = (
  actor: PortalActor,
  input: SubmitClientBugInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const link = await transaction.orm.public.ClientCompanyProject.where({
      companyId: actor.clientCompanyId,
      projectId: input.projectId,
      removedAt: null,
    })
      .select("id")
      .first();
    if (!link) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Choose one of your company's projects.",
      });
    }
    const created = await createBugReport(
      transaction,
      actor.id,
      {
        actualBehavior: input.actualBehavior,
        appVersion: null,
        browser: trimmedOrNull(input.browser),
        component: "Client report",
        description: trimmedOrNull(input.description),
        device: trimmedOrNull(input.device),
        discoverySource: "customer_report",
        environment: "production",
        expectedBehavior: input.expectedBehavior,
        os: trimmedOrNull(input.os),
        projectId: input.projectId,
        reproductionSteps: input.reproductionSteps,
        route: input.pageUrl,
        severity: severityForImpact[input.impact],
        title: input.title,
      },
      { clientCompanyId: actor.clientCompanyId, clientImpact: input.impact }
    );
    await createBugSla(transaction, {
      bugId: created.id,
      impact: input.impact,
      now: new Date(),
    });
    if (input.recurrenceOfBugId) {
      const earlier = await loadCompanyBug(
        transaction,
        actor,
        input.recurrenceOfBugId
      );
      if (earlier.bug.status !== "closed") {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Only a closed bug can be reported again.",
        });
      }
      await transaction.orm.public.BugRelation.create({
        createdAt: new Date(),
        createdById: actor.id,
        fromBugReportId: created.id,
        id: randomUUID(),
        toBugReportId: earlier.bug.id,
        type: "recurrence",
      });
    }
    await announceClientBug(transaction, {
      bugId: created.id,
      now: new Date(),
      reporterId: actor.id,
    });
    return { bugId: created.id, version: created.version };
  });

const requireReporterWhileSubmitted = (
  actor: PortalActor,
  bug: { readonly reporterId: string; readonly status: string }
): void => {
  if (bug.reporterId !== actor.id) {
    forbidden("Only the person who reported this bug can change it.");
  }
  if (bug.status !== "reported") {
    forbidden("A bug can only be changed while it is still Submitted.");
  }
};

export const editBug = (
  actor: PortalActor,
  input: EditClientBugInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const { bug, project, task } = await loadWritableCompanyBug(
      transaction,
      actor,
      input.bugId
    );
    requireReporterWhileSubmitted(actor, bug);
    if (bug.version !== input.expectedVersion) {
      conflict();
    }
    const cleaned = validateInput({
      assigneeIds: [],
      description: trimmedOrNull(input.description),
      dueDate: null,
      priority: "none",
      projectId: project.id,
      title: input.title,
    });
    const now = new Date();
    const version = bug.version + 1;
    const updated = await transaction.orm.public.BugReport.where({
      id: bug.id,
      status: "reported",
      version: bug.version,
    }).updateAndCount({
      actualBehavior: input.actualBehavior.trim(),
      browser: trimmedOrNull(input.browser),
      clientImpact: input.impact,
      description: trimmedOrNull(input.description),
      device: trimmedOrNull(input.device),
      expectedBehavior: input.expectedBehavior.trim(),
      os: trimmedOrNull(input.os),
      reproductionSteps: input.reproductionSteps.map((step) => step.trim()),
      route: input.pageUrl.trim(),
      severity: severityForImpact[input.impact],
      updatedAt: now,
      version,
    });
    if (!updated) {
      conflict();
    }
    const taskUpdated = await transaction.orm.public.Task.where({
      id: task.id,
      version: task.version,
    }).updateAndCount({
      description: cleaned.description,
      title: cleaned.title,
      updatedAt: now,
      version: task.version + 1,
    });
    if (!taskUpdated) {
      conflict();
    }
    await writeActivity(transaction, {
      action: "bug.client_edited",
      actorId: actor.id,
      bugId: bug.id,
      details: {},
      now,
      projectId: project.id,
      taskId: task.id,
    });
    return { bugId: bug.id, version };
  });

export const withdrawBug = (
  actor: PortalActor,
  input: ClientBugVersionInput
): Effect.Effect<PortalBugReceipt, AppError> =>
  run(async (transaction) => {
    const { bug } = await loadWritableCompanyBug(
      transaction,
      actor,
      input.bugId
    );
    requireReporterWhileSubmitted(actor, bug);
    if (bug.version !== input.expectedVersion) {
      conflict();
    }
    const receipt = await updateBugStatus(transaction, {
      actorId: actor.id,
      bug,
      details: { withdrawn: true },
      nextStatus: "withdrawn",
      now: new Date(),
    });
    return { bugId: receipt.bugId, version: receipt.version };
  });

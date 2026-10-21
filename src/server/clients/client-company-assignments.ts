import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";

import { AppError } from "../core/action-result";
import { addActivity, requireAdmin } from "../people/user-internal";
import type {
  ClientCompanyReceipt,
  SetClientCompanyHandlersInput,
  SetClientCompanyProjectsInput,
} from "./client-company-contracts";
import { bumpCompany, loadCompany, run } from "./client-company-core";
import { flagHandlerBugsForReassignment } from "./client-handler-reassignment";

export const setProjects = (
  actorId: string,
  input: SetClientCompanyProjectsInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    const projectIds = [...new Set(input.projectIds)];
    const now = new Date();
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      now
    );
    if (projectIds.length > 0) {
      const projects = await transaction.orm.public.Project.where((project) =>
        and(project.id.in(projectIds), project.archivedAt.isNull())
      )
        .select("id")
        .all();
      if (projects.length !== projectIds.length) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose active projects for the client company.",
        });
      }
    }
    const links = await transaction.orm.public.ClientCompanyProject.where({
      companyId: company.id,
    }).all();
    const wanted = new Set(projectIds);
    const existing = new Map(links.map((link) => [link.projectId, link]));
    const removed: string[] = [];
    const restored: string[] = [];
    for (const link of links) {
      if (link.removedAt === null && !wanted.has(link.projectId)) {
        removed.push(link.id);
      } else if (link.removedAt !== null && wanted.has(link.projectId)) {
        restored.push(link.id);
      }
    }
    const added = projectIds.filter((projectId) => !existing.has(projectId));
    // Removal is soft: existing bugs stay visible, only new reports stop.
    if (removed.length > 0) {
      await transaction.orm.public.ClientCompanyProject.where((link) =>
        link.id.in(removed)
      ).updateAll({ removedAt: now });
    }
    if (restored.length > 0) {
      await transaction.orm.public.ClientCompanyProject.where((link) =>
        link.id.in(restored)
      ).updateAll({ addedAt: now, removedAt: null });
    }
    await Promise.all(
      added.map((projectId) =>
        transaction.orm.public.ClientCompanyProject.create({
          addedAt: now,
          companyId: company.id,
          id: randomUUID(),
          projectId,
          removedAt: null,
        })
      )
    );
    await addActivity(transaction, actorId, "client_company.projects_set", {
      added: added.length + restored.length,
      companyId: company.id,
      removed: removed.length,
    });
    return receipt;
  });

export const setHandlers = (
  actorId: string,
  input: SetClientCompanyHandlersInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    const employeeIds = [...new Set(input.employeeIds)];
    const now = new Date();
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      now
    );
    if (employeeIds.length > 0) {
      const employees = await transaction.orm.public.User.where((user) =>
        and(
          user.id.in(employeeIds),
          user.deactivatedAt.isNull(),
          user.role.neq("client")
        )
      )
        .select("id")
        .all();
      if (employees.length !== employeeIds.length) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Choose active employees as handlers.",
        });
      }
    }
    const current = await transaction.orm.public.ClientCompanyHandler.where({
      companyId: company.id,
    }).all();
    const wanted = new Set(employeeIds);
    const currentIds = new Set(current.map(({ employeeId }) => employeeId));
    const removed = current.filter(({ employeeId }) => !wanted.has(employeeId));
    const added = employeeIds.filter((id) => !currentIds.has(id));
    if (removed.length > 0) {
      await transaction.orm.public.ClientCompanyHandler.where((handler) =>
        handler.id.in(removed.map(({ id }) => id))
      ).deleteAll();
    }
    await Promise.all(
      added.map((employeeId) =>
        transaction.orm.public.ClientCompanyHandler.create({
          assignedById: actorId,
          companyId: company.id,
          createdAt: now,
          employeeId,
          id: randomUUID(),
        })
      )
    );
    // One pass for every removed handler, so a bug they shared is flagged
    // and announced once.
    await flagHandlerBugsForReassignment(transaction, {
      actorId,
      companyId: company.id,
      employeeIds: removed.map(({ employeeId }) => employeeId),
      now,
    });
    await addActivity(transaction, actorId, "client_company.handlers_set", {
      added: added.length,
      companyId: company.id,
      removed: removed.length,
    });
    return receipt;
  });

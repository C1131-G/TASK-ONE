import { randomBytes, randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect, Layer, Schema } from "effect";

import {
  clientStatusLabel,
  clientStatusLabels,
  isOpenClientLabel,
} from "@/features/portal/client-status";
import { db } from "@/src/prisma/db";

import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";
import type { DbTransaction } from "../people/user-internal";
import {
  addActivity,
  createCredentialUser,
  databaseError,
  requireAdmin,
  serializeAdminChanges,
  validatePerson,
} from "../people/user-internal";
import { decodeBugWorkflowStatus } from "../work/bug-workflow-internal";
import type {
  ClientCompanyDetail,
  ClientCompanyReceipt,
  ClientCompanySummary,
  ClientCompanyVersionInput,
  CreateClientCompanyInput,
  CreateClientUserInput,
  CreatedClientUser,
  SetClientCompanyHandlersInput,
  SetClientCompanyProjectsInput,
  UpdateClientCompanyInput,
} from "./client-company-contracts";
import {
  ClientCompanyDetailSchema,
  ClientCompanyManagement,
} from "./client-company-contracts";
import { flagHandlerBugsForReassignment } from "./client-handler-reassignment";

const companyError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  const mapped = databaseError(error);
  return mapped.code === "CONFLICT"
    ? new AppError({
        code: "CONFLICT",
        message: "A client company or account with that name already exists.",
      })
    : new AppError({
        code: "UNAVAILABLE",
        message: "The client company request could not be completed.",
      });
};

const conflict = (): never => {
  throw new AppError({
    code: "CONFLICT",
    message: "The client company changed. Refresh and try again.",
  });
};

const loadCompany = async (transaction: DbTransaction, companyId: string) => {
  const company = await transaction.orm.public.ClientCompany.where({
    id: companyId,
  }).first();
  if (!company) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "The client company was not found.",
    });
  }
  return company;
};

// Locks the company row by bumping its version; a stale version is a conflict.
const bumpCompany = async (
  transaction: DbTransaction,
  company: { readonly id: string; readonly version: number },
  expectedVersion: number,
  now: Date,
  changes: Record<string, unknown> = {}
): Promise<ClientCompanyReceipt> => {
  if (company.version !== expectedVersion) {
    conflict();
  }
  const version = company.version + 1;
  const updated = await transaction.orm.public.ClientCompany.where({
    id: company.id,
    version: company.version,
  }).updateAndCount({ ...changes, updatedAt: now, version });
  if (!updated) {
    conflict();
  }
  return { companyId: company.id, version };
};

const run = <Output>(
  operation: (transaction: DbTransaction) => Promise<Output>
): Effect.Effect<Output, AppError> =>
  Effect.tryPromise({
    catch: companyError,
    try: () =>
      db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        return operation(transaction);
      }),
  });

const summarize = async (
  transaction: DbTransaction,
  companyIds: readonly string[]
) => {
  if (companyIds.length === 0) {
    return {
      bugs: [] as const,
      handlers: [] as const,
      projects: [] as const,
      users: [] as const,
    };
  }
  const ids = [...companyIds];
  const [users, projects, handlers, bugs] = await Promise.all([
    transaction.orm.public.User.where((user) =>
      and(user.clientCompanyId.in(ids), user.deactivatedAt.isNull())
    )
      .select("clientCompanyId")
      .all(),
    transaction.orm.public.ClientCompanyProject.where((link) =>
      and(link.companyId.in(ids), link.removedAt.isNull())
    )
      .select("companyId")
      .all(),
    transaction.orm.public.ClientCompanyHandler.where((handler) =>
      handler.companyId.in(ids)
    )
      .select("companyId")
      .all(),
    transaction.orm.public.BugReport.where((bug) => bug.clientCompanyId.in(ids))
      .select("clientCompanyId", "status", "resolution")
      .all(),
  ]);
  return { bugs, handlers, projects, users };
};

const countBy = (rows: readonly { readonly key: string | null }[]) => {
  const counts = new Map<string, number>();
  for (const { key } of rows) {
    if (key) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return counts;
};

const listCompanies = (
  actorId: string
): Effect.Effect<readonly ClientCompanySummary[], AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const companies = await transaction.orm.public.ClientCompany.orderBy(
      (company) => company.name.asc()
    ).all();
    const { bugs, handlers, projects, users } = await summarize(
      transaction,
      companies.map(({ id }) => id)
    );
    const userCounts = countBy(
      users.map(({ clientCompanyId }) => ({ key: clientCompanyId }))
    );
    const projectCounts = countBy(
      projects.map(({ companyId }) => ({ key: companyId }))
    );
    const handlerCounts = countBy(
      handlers.map(({ companyId }) => ({ key: companyId }))
    );
    const openBugCounts = countBy(
      bugs.flatMap(({ clientCompanyId, resolution, status }) =>
        isOpenClientLabel(
          clientStatusLabel(decodeBugWorkflowStatus(status), resolution)
        )
          ? [{ key: clientCompanyId }]
          : []
      )
    );
    return companies.map((company) => ({
      active: company.deactivatedAt === null,
      handlerCount: handlerCounts.get(company.id) ?? 0,
      id: company.id,
      name: company.name,
      openBugCount: openBugCounts.get(company.id) ?? 0,
      projectCount: projectCounts.get(company.id) ?? 0,
      userCount: userCounts.get(company.id) ?? 0,
      version: company.version,
    }));
  });

const getCompany = (
  actorId: string,
  companyId: string
): Effect.Effect<ClientCompanyDetail, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    if (!Schema.is(Schema.String.check(Schema.isUUID()))(companyId)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "The client company ID is invalid.",
      });
    }
    const [company, users, links, handlerRows, bugs] = await Promise.all([
      loadCompany(transaction, companyId),
      transaction.orm.public.User.where({ clientCompanyId: companyId })
        .orderBy((user) => user.name.asc())
        .all(),
      transaction.orm.public.ClientCompanyProject.where((link) =>
        and(link.companyId.eq(companyId), link.removedAt.isNull())
      ).all(),
      transaction.orm.public.ClientCompanyHandler.where({
        companyId,
      }).all(),
      transaction.orm.public.BugReport.where({ clientCompanyId: companyId })
        .select("status", "resolution")
        .all(),
    ]);
    const [projects, employees] = await Promise.all([
      links.length === 0
        ? []
        : transaction.orm.public.Project.where((project) =>
            project.id.in(links.map(({ projectId }) => projectId))
          )
            .orderBy((project) => project.name.asc())
            .all(),
      handlerRows.length === 0
        ? []
        : transaction.orm.public.User.where((user) =>
            user.id.in(handlerRows.map(({ employeeId }) => employeeId))
          )
            .orderBy((user) => user.name.asc())
            .all(),
    ]);
    const now = Date.now();
    const labelCounts = new Map<string, number>();
    for (const bug of bugs) {
      const label = clientStatusLabel(
        decodeBugWorkflowStatus(bug.status),
        bug.resolution
      );
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
    return Schema.decodeUnknownSync(Schema.toType(ClientCompanyDetailSchema))({
      bugCounts: clientStatusLabels.map((label) => ({
        count: labelCounts.get(label) ?? 0,
        label,
      })),
      company: {
        active: company.deactivatedAt === null,
        handlerCount: handlerRows.length,
        id: company.id,
        name: company.name,
        openBugCount: bugs.filter(({ resolution, status }) =>
          isOpenClientLabel(
            clientStatusLabel(decodeBugWorkflowStatus(status), resolution)
          )
        ).length,
        projectCount: links.length,
        userCount: users.filter(({ deactivatedAt }) => !deactivatedAt).length,
        version: company.version,
      },
      handlers: employees.map((employee) => ({
        active: employee.deactivatedAt === null,
        email: employee.email,
        id: employee.id,
        name: employee.name,
      })),
      projects: projects.map((project) => ({
        archived: project.archivedAt !== null,
        id: project.id,
        key: project.key,
        name: project.name,
      })),
      users: users.map((user) => ({
        active: user.deactivatedAt === null,
        email: user.email,
        id: user.id,
        lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
        locked: user.lockedUntil !== null && user.lockedUntil.getTime() > now,
        mustChangePassword: user.mustChangePassword,
        name: user.name,
      })),
    });
  });

const createCompany = (
  actorId: string,
  input: CreateClientCompanyInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const now = new Date();
    const id = randomUUID();
    await transaction.orm.public.ClientCompany.create({
      createdAt: now,
      createdById: actorId,
      deactivatedAt: null,
      deactivatedById: null,
      id,
      logoAssetId: null,
      name: input.name,
      updatedAt: now,
      version: 1,
    });
    await addActivity(transaction, actorId, "client_company.created", {
      companyId: id,
      name: input.name,
    });
    return { companyId: id, version: 1 };
  });

const updateCompany = (
  actorId: string,
  input: UpdateClientCompanyInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      new Date(),
      { name: input.name }
    );
    await addActivity(transaction, actorId, "client_company.updated", {
      companyId: company.id,
      name: input.name,
    });
    return receipt;
  });

const setProjects = (
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

const setHandlers = (
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
    for (const handler of removed) {
      // Sequential: each flagging pass reads bugs the previous one may touch.
      // eslint-disable-next-line no-await-in-loop, react-doctor/async-await-in-loop
      await flagHandlerBugsForReassignment(transaction, {
        actorId,
        companyId: company.id,
        employeeId: handler.employeeId,
        now,
      });
    }
    await addActivity(transaction, actorId, "client_company.handlers_set", {
      added: added.length,
      companyId: company.id,
      removed: removed.length,
    });
    return receipt;
  });

const deactivateCompany = (
  actorId: string,
  input: ClientCompanyVersionInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    if (company.deactivatedAt) {
      throw new AppError({
        code: "CONFLICT",
        message: "The client company is already deactivated.",
      });
    }
    const now = new Date();
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      now,
      { deactivatedAt: now, deactivatedById: actorId }
    );
    // The version bump above locks the company before its users change.
    // eslint-disable-next-line react-doctor/server-sequential-independent-await
    const users = await transaction.orm.public.User.where((user) =>
      and(user.clientCompanyId.eq(company.id), user.deactivatedAt.isNull())
    )
      .select("id")
      .all();
    const userIds = users.map(({ id }) => id);
    if (userIds.length > 0) {
      await transaction.orm.public.User.where((user) =>
        user.id.in(userIds)
      ).updateAll({
        deactivatedAt: now,
        deactivatedById: actorId,
        updatedAt: now,
      });
      // Deactivated client users are signed out everywhere at once.
      await transaction.orm.public.Session.where((session) =>
        session.userId.in(userIds)
      ).deleteAll();
    }
    await addActivity(transaction, actorId, "client_company.deactivated", {
      companyId: company.id,
      usersDeactivated: userIds.length,
    });
    return receipt;
  });

const reactivateCompany = (
  actorId: string,
  input: ClientCompanyVersionInput
): Effect.Effect<ClientCompanyReceipt, AppError> =>
  run(async (transaction) => {
    await requireAdmin(transaction, actorId);
    const company = await loadCompany(transaction, input.companyId);
    if (!company.deactivatedAt) {
      throw new AppError({
        code: "CONFLICT",
        message: "The client company is already active.",
      });
    }
    // Users stay deactivated; an admin reactivates the ones who return.
    const receipt = await bumpCompany(
      transaction,
      company,
      input.expectedVersion,
      new Date(),
      { deactivatedAt: null, deactivatedById: null }
    );
    await addActivity(transaction, actorId, "client_company.reactivated", {
      companyId: company.id,
    });
    return receipt;
  });

const createClientUser = (
  actorId: string,
  input: CreateClientUserInput
): Effect.Effect<CreatedClientUser, AppError> =>
  Effect.tryPromise({
    catch: databaseError,
    try: async () => {
      const values = validatePerson(input.email, input.name, null);
      const temporaryPassword = randomBytes(30).toString("base64url");
      const passwordContext = await auth.$context;
      const passwordHash =
        await passwordContext.password.hash(temporaryPassword);
      return db.transaction(async (transaction) => {
        await serializeAdminChanges(transaction);
        await requireAdmin(transaction, actorId);
        const company = await loadCompany(transaction, input.companyId);
        if (company.deactivatedAt) {
          throw new AppError({
            code: "CONFLICT",
            message: "Reactivate the client company before adding users.",
          });
        }
        const created = await createCredentialUser(transaction, {
          ...values,
          activityAction: "client_user.created",
          actorId,
          clientCompanyId: company.id,
          passwordHash,
          role: "client",
          teamId: null,
          temporaryPassword,
        });
        return {
          email: created.email,
          id: created.id,
          name: created.name,
          temporaryPassword,
        };
      });
    },
  });

export const ClientCompanyManagementLive = Layer.succeed(
  ClientCompanyManagement,
  ClientCompanyManagement.of({
    createClientUser,
    createCompany,
    deactivateCompany,
    getCompany,
    listCompanies,
    reactivateCompany,
    setHandlers,
    setProjects,
    updateCompany,
  })
);

import { and } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";
import { Schema } from "effect";

import {
  clientStatusLabel,
  clientStatusLabels,
  isOpenClientLabel,
} from "@/features/portal/client-status";

import { loadSlaSettings } from "../company/sla-settings";
import { AppError } from "../core/action-result";
import type { DbTransaction } from "../people/user-internal";
import { requireAdmin } from "../people/user-internal";
import { decodeBugWorkflowStatus } from "../work/bug-workflow-internal";
import type {
  ClientCompanyDetail,
  ClientCompanySummary,
} from "./client-company-contracts";
import { ClientCompanyDetailSchema } from "./client-company-contracts";
import { loadCompany, run } from "./client-company-core";
import { companyInsight } from "./client-company-insight";

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

export const listCompanies = (
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

export const getCompany = (
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
        .select(
          "id",
          "status",
          "resolution",
          "satisfaction",
          "clientReopenCount"
        )
        .all(),
    ]);
    const [slas, slaSettings, projects, employees] = await Promise.all([
      bugs.length === 0
        ? []
        : transaction.orm.public.BugSla.where((sla) =>
            sla.bugId.in(bugs.map(({ id }) => id))
          )
            .select(
              "breachedResolution",
              "breachedResponse",
              "createdAt",
              "firstRespondedAt"
            )
            .all(),
      loadSlaSettings(transaction),
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
      insight: companyInsight(bugs, slas, slaSettings),
      projects: projects.map((project) => ({
        archived: project.archivedAt !== null,
        id: project.id,
        key: project.key,
        name: project.name,
      })),
      satisfaction: {
        down: bugs.filter(({ satisfaction }) => satisfaction === "down").length,
        up: bugs.filter(({ satisfaction }) => satisfaction === "up").length,
      },
      sla: {
        resolutionBreaches: slas.filter(
          ({ breachedResolution }) => breachedResolution
        ).length,
        responseBreaches: slas.filter(
          ({ breachedResponse }) => breachedResponse
        ).length,
        tracked: slas.length,
      },
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

import { Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import { toApprovalStatus } from "./approval-access";

export const isUuid = Schema.is(UUIDSchema);

// Approvals are read by active team members only; clients answer through the
// portal.
export const assertStaffReader = async (actorId: string) => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "role")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.role === "client" || actor.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Approvals are managed by the team.",
    });
  }
  return actor;
};

interface RequestRow {
  readonly cancelledAt: Date | null;
  readonly companyId: string;
  readonly decidedAt: Date | null;
  readonly decidedById: string | null;
  readonly decisionComment: string | null;
  readonly id: string;
  readonly message: string;
  readonly requestedAt: Date;
  readonly requestedById: string;
  readonly status: string;
  readonly version: number;
}

// The staff view of requests: who asked, who decided, the company and the
// attached file names, newest version first. Also returns the loaded
// companies (those of the requests plus any asked for) so callers need not
// read them twice.
export const describeRequests = async (
  rows: readonly RequestRow[],
  extraCompanyIds: readonly string[] = []
) => {
  const companyIds = [
    ...new Set([...extraCompanyIds, ...rows.map(({ companyId }) => companyId)]),
  ];
  const userIds = [
    ...new Set(
      rows.flatMap(({ decidedById, requestedById }) =>
        decidedById ? [requestedById, decidedById] : [requestedById]
      )
    ),
  ];
  const [companies, users, attachments] = await Promise.all([
    companyIds.length === 0
      ? []
      : db.orm.public.ClientCompany.where((company) =>
          company.id.in(companyIds)
        )
          .select("id", "name", "deactivatedAt")
          .all(),
    userIds.length === 0
      ? []
      : db.orm.public.User.where((user) => user.id.in(userIds))
          .select("id", "name")
          .all(),
    rows.length === 0
      ? []
      : db.orm.public.ApprovalRequestFile.include("file")
          .where((attached) => attached.requestId.in(rows.map(({ id }) => id)))
          .all(),
  ]);
  const companyNames = new Map(companies.map(({ id, name }) => [id, name]));
  const userNames = new Map(users.map(({ id, name }) => [id, name]));
  const requests = rows
    .toSorted((first, second) => second.version - first.version)
    .map((row) => ({
      cancelledAt: row.cancelledAt?.toISOString() ?? null,
      companyId: row.companyId,
      companyName: companyNames.get(row.companyId) ?? "",
      decidedAt: row.decidedAt?.toISOString() ?? null,
      decidedByName: row.decidedById
        ? (userNames.get(row.decidedById) ?? null)
        : null,
      decisionComment: row.decisionComment,
      // A file removed after it was attached is no longer listed.
      files: attachments.flatMap(({ file, requestId }) =>
        requestId === row.id && !file.deletedAt
          ? [{ fileId: file.id, fileName: file.originalName }]
          : []
      ),
      id: row.id,
      message: row.message,
      requestedAt: row.requestedAt.toISOString(),
      requestedByName: userNames.get(row.requestedById) ?? "",
      status: toApprovalStatus(row.status),
      version: row.version,
    }));
  return { companies, requests };
};

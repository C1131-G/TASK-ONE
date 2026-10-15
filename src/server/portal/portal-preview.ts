import { db } from "@/src/prisma/db";

import { recordAuditEvent } from "../audit/audit-log";
import { auth } from "../auth/auth";
import { AppError } from "../core/action-result";

// An admin may look at the portal as one of its clients. Only the admin's own
// session can start it, the target must be an active client of an active
// company, and every start and end is audited.
const requireAdminSession = async (headers: Headers) => {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  const admin = await db.orm.public.User.where({ id: session.user.id })
    .select("id", "role", "deactivatedAt", "mustChangePassword")
    .first();
  if (
    !admin ||
    admin.deactivatedAt ||
    admin.mustChangePassword ||
    admin.role !== "admin"
  ) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
  return admin;
};

const loadClient = async (clientUserId: string) => {
  const client = await db.orm.public.User.where({ id: clientUserId })
    .select("id", "role", "deactivatedAt", "clientCompanyId", "name")
    .first();
  const company = client?.clientCompanyId
    ? await db.orm.public.ClientCompany.where({ id: client.clientCompanyId })
        .select("deactivatedAt")
        .first()
    : null;
  if (
    !client ||
    client.role !== "client" ||
    client.deactivatedAt ||
    !company ||
    company.deactivatedAt
  ) {
    throw new AppError({
      code: "NOT_FOUND",
      message: "That client account is not available to preview.",
    });
  }
  return client;
};

export const startPortalPreview = async (
  headers: Headers,
  clientUserId: string
): Promise<void> => {
  const admin = await requireAdminSession(headers);
  const client = await loadClient(clientUserId);
  await recordAuditEvent(db, {
    actorId: admin.id,
    details: { clientCompanyId: client.clientCompanyId },
    headers,
    subjectUserId: client.id,
    type: "preview_started",
  });
};

export const endPortalPreview = async (
  headers: Headers,
  clientUserId: string
): Promise<void> => {
  const admin = await requireAdminSession(headers);
  await recordAuditEvent(db, {
    actorId: admin.id,
    headers,
    subjectUserId: clientUserId,
    type: "preview_ended",
  });
};

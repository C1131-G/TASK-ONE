import { and } from "@prisma/orm-postgres/orm-client";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { resolveClientIp } from "../core/client-ip";

export const AUDIT_EVENT_TYPES = [
  "login_succeeded",
  "login_failed",
  "login_blocked",
  "account_locked",
  "account_unlocked",
  "password_changed",
  "password_reset",
  "user_deactivated",
  "user_reactivated",
  "company_deactivated",
  "company_reactivated",
  "preview_started",
  "preview_ended",
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AuditEventTypeSchema = Schema.Literals(AUDIT_EVENT_TYPES);

type Writer = Pick<typeof db, "orm">;

const MAX_UA_LENGTH = 300;
const MAX_IP_LENGTH = 64;

export interface RequestMetadata {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

// Where a request came from, for the audit trail. The address comes from the
// trusted proxy header only; a missing or invalid value reads as unknown.
export const requestMetadata = (
  headers: Headers | undefined | null
): RequestMetadata => {
  const ip = resolveClientIp(headers) ?? null;
  const userAgent = headers?.get("user-agent")?.trim() || null;
  return {
    ip: ip ? ip.slice(0, MAX_IP_LENGTH) : null,
    userAgent: userAgent ? userAgent.slice(0, MAX_UA_LENGTH) : null,
  };
};

export interface AuditInput {
  readonly type: AuditEventType;
  readonly actorId?: string | null;
  readonly subjectUserId?: string | null;
  readonly headers?: Headers | null;
  // Facts about the event. Never put secrets here.
  readonly details?: Record<string, string | number | boolean | null>;
  readonly now?: Date;
}

export const recordAuditEvent = async (
  writer: Writer,
  input: AuditInput
): Promise<void> => {
  const { ip, userAgent } = requestMetadata(input.headers);
  await writer.orm.public.AuditEvent.create({
    actorId: input.actorId ?? null,
    createdAt: input.now ?? new Date(),
    details: input.details ?? {},
    id: crypto.randomUUID(),
    ip,
    subjectUserId: input.subjectUserId ?? null,
    type: input.type,
    userAgent,
  });
};

// The trail must never break the action it records.
export const recordAuditEventSafely = async (
  writer: Writer,
  input: AuditInput
): Promise<void> => {
  try {
    await recordAuditEvent(writer, input);
  } catch {
    // An unavailable audit table must not block a sign-in or an admin action.
  }
};

// For use inside an action's Effect: records the event once the step
// before it has succeeded.
export const auditEffect = (input: AuditInput): Effect.Effect<void> =>
  Effect.promise(() => recordAuditEventSafely(db, input));

export const AuditFilterSchema = Schema.Struct({
  from: Schema.optional(Schema.DateFromString),
  limit: Schema.optional(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(500)
    )
  ),
  query: Schema.optional(Schema.String.check(Schema.isMaxLength(120))),
  to: Schema.optional(Schema.DateFromString),
  type: Schema.optional(AuditEventTypeSchema),
});

export type AuditFilter = typeof AuditFilterSchema.Type;

export const AuditEntrySchema = Schema.Struct({
  actorName: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  details: Schema.Json,
  id: Schema.String,
  ip: Schema.NullOr(Schema.String),
  subjectEmail: Schema.NullOr(Schema.String),
  subjectName: Schema.NullOr(Schema.String),
  type: Schema.String,
  userAgent: Schema.NullOr(Schema.String),
});

export const AuditListSchema = Schema.Array(AuditEntrySchema);

export const LockedAccountSchema = Schema.Struct({
  clientCompanyName: Schema.NullOr(Schema.String),
  email: Schema.String,
  failedLoginCount: Schema.Number,
  id: Schema.String,
  lockedUntil: Schema.String,
  name: Schema.String,
});

export const LockedAccountListSchema = Schema.Array(LockedAccountSchema);

export class AuditLog extends Context.Service<
  AuditLog,
  {
    readonly list: (
      actorId: string,
      filter: AuditFilter
    ) => Effect.Effect<typeof AuditListSchema.Type, AppError>;
    readonly lockedAccounts: (
      actorId: string
    ) => Effect.Effect<typeof LockedAccountListSchema.Type, AppError>;
  }
>()("taskora/server/AuditLog") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The audit log could not be loaded.",
      });

const requireAdmin = async (actorId: string): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword || actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
};

const listEvents = async (actorId: string, filter: AuditFilter) => {
  await requireAdmin(actorId);
  const needle = filter.query?.trim().toLowerCase() ?? "";
  let subjectIds: string[] | null = null;
  if (needle) {
    const pattern = `%${needle}%`;
    const matches = await db.orm.public.User.where((user) =>
      user.email.ilike(pattern)
    )
      .select("id")
      .limit(200)
      .all();
    const byName = await db.orm.public.User.where((user) =>
      user.name.ilike(pattern)
    )
      .select("id")
      .limit(200)
      .all();
    subjectIds = [...matches, ...byName].map(({ id }) => id);
  }
  const events = await db.orm.public.AuditEvent.where((event) =>
    and(
      ...(filter.type ? [event.type.eq(filter.type)] : []),
      ...(filter.from ? [event.createdAt.gte(filter.from)] : []),
      ...(filter.to ? [event.createdAt.lte(filter.to)] : []),
      ...(subjectIds ? [event.subjectUserId.in(subjectIds)] : [])
    )
  )
    .orderBy((event) => event.createdAt.desc())
    .limit(filter.limit ?? 200)
    .all();
  const userIds = [
    ...new Set(
      events.flatMap((event) =>
        [event.actorId, event.subjectUserId].flatMap((id) => (id ? [id] : []))
      )
    ),
  ];
  const users =
    userIds.length === 0
      ? []
      : await db.orm.public.User.where((user) => user.id.in(userIds))
          .select("id", "name", "email")
          .all();
  const byId = new Map(users.map((user) => [user.id, user]));
  return events.map((event) => ({
    actorName: event.actorId ? (byId.get(event.actorId)?.name ?? null) : null,
    createdAt: event.createdAt.toISOString(),
    details: event.details ?? {},
    id: event.id,
    ip: event.ip,
    subjectEmail: event.subjectUserId
      ? (byId.get(event.subjectUserId)?.email ?? null)
      : null,
    subjectName: event.subjectUserId
      ? (byId.get(event.subjectUserId)?.name ?? null)
      : null,
    type: event.type,
    userAgent: event.userAgent,
  }));
};

const listLocked = async (actorId: string) => {
  await requireAdmin(actorId);
  const now = new Date();
  const users = await db.orm.public.User.where((user) =>
    user.lockedUntil.gt(now)
  )
    .orderBy((user) => user.lockedUntil.desc())
    .limit(200)
    .all();
  const companyIds = [
    ...new Set(
      users.flatMap((user) =>
        user.clientCompanyId ? [user.clientCompanyId] : []
      )
    ),
  ];
  const companies =
    companyIds.length === 0
      ? []
      : await db.orm.public.ClientCompany.where((company) =>
          company.id.in(companyIds)
        )
          .select("id", "name")
          .all();
  const companyById = new Map(companies.map(({ id, name }) => [id, name]));
  return users.flatMap((user) =>
    user.lockedUntil
      ? [
          {
            clientCompanyName: user.clientCompanyId
              ? (companyById.get(user.clientCompanyId) ?? null)
              : null,
            email: user.email,
            failedLoginCount: user.failedLoginCount,
            id: user.id,
            lockedUntil: user.lockedUntil.toISOString(),
            name: user.name,
          },
        ]
      : []
  );
};

export const AuditLogLive = Layer.succeed(
  AuditLog,
  AuditLog.of({
    list: (actorId, filter) =>
      Effect.tryPromise({
        catch: mapError,
        try: () => listEvents(actorId, filter),
      }),
    lockedAccounts: (actorId) =>
      Effect.tryPromise({ catch: mapError, try: () => listLocked(actorId) }),
  })
);

import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { BusinessCalendar } from "../work/business-time";

export const ImpactKeys = ["low", "medium", "high", "urgent"] as const;
export type ImpactKey = (typeof ImpactKeys)[number];

const MinutesSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(1),
  // A year of working time is far beyond any real target.
  Schema.isLessThanOrEqualTo(525_600)
);

const TargetSchema = Schema.Struct({
  firstResponseMinutes: MinutesSchema,
  resolutionMinutes: MinutesSchema,
});

export const SlaTargetsSchema = Schema.Struct({
  high: TargetSchema,
  low: TargetSchema,
  medium: TargetSchema,
  urgent: TargetSchema,
});

export type SlaTargets = typeof SlaTargetsSchema.Type;

const supportedTimezones = new Set([
  ...Intl.supportedValuesOf("timeZone"),
  "UTC",
  "Asia/Kolkata",
  "Asia/Calcutta",
]);

export const SlaSettingsInputSchema = Schema.Struct({
  businessDays: Schema.Array(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isGreaterThanOrEqualTo(0),
      Schema.isLessThanOrEqualTo(6)
    )
  ).check(Schema.isMinLength(1), Schema.isMaxLength(7)),
  businessEndMinute: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(1440)
  ),
  businessStartMinute: Schema.Number.check(
    Schema.isInt(),
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThanOrEqualTo(1439)
  ),
  // Null follows the company time zone.
  businessTimeZone: Schema.NullOr(
    Schema.String.check(
      Schema.makeFilter((timeZone) =>
        supportedTimezones.has(timeZone)
          ? undefined
          : "Choose a supported time zone."
      )
    )
  ),
  slaTargets: SlaTargetsSchema,
});

export type SlaSettingsInput = typeof SlaSettingsInputSchema.Type;

export const SlaSettingsValuesSchema = Schema.Struct({
  ...SlaSettingsInputSchema.fields,
  // The zone the calendar actually uses.
  effectiveTimeZone: Schema.String,
});

export type SlaSettingsValues = typeof SlaSettingsValuesSchema.Type;

export interface SlaSettings {
  readonly calendar: BusinessCalendar;
  readonly targets: SlaTargets;
}

export const DEFAULT_SLA_TARGETS: SlaTargets = {
  high: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  low: { firstResponseMinutes: 1440, resolutionMinutes: 14_400 },
  medium: { firstResponseMinutes: 480, resolutionMinutes: 4800 },
  urgent: { firstResponseMinutes: 60, resolutionMinutes: 480 },
};

type SettingsRow = NonNullable<
  Awaited<ReturnType<typeof db.orm.public.CompanySettings.first>>
>;

// Stored targets are validated on the way out so a bad row can never stall
// the SLA clocks; it falls back to the defaults.
const parseTargets = (value: unknown): SlaTargets => {
  try {
    return Schema.decodeUnknownSync(SlaTargetsSchema)(value);
  } catch {
    return DEFAULT_SLA_TARGETS;
  }
};

export const toSlaSettingsValues = (row: SettingsRow) => {
  const businessTimeZone = row.businessTimeZone ?? null;
  return {
    businessDays: [...row.businessDays].toSorted(
      (day, otherDay) => day - otherDay
    ),
    businessEndMinute: row.businessEndMinute,
    businessStartMinute: row.businessStartMinute,
    businessTimeZone,
    effectiveTimeZone: businessTimeZone ?? row.timeZone,
    slaTargets: parseTargets(row.slaTargets),
  };
};

export const toSlaSettings = (row: SettingsRow): SlaSettings => {
  const values = toSlaSettingsValues(row);
  return {
    calendar: {
      days: values.businessDays,
      endMinute: values.businessEndMinute,
      startMinute: values.businessStartMinute,
      timeZone: values.effectiveTimeZone,
    },
    targets: values.slaTargets,
  };
};

type Reader = Pick<typeof db, "orm">;

export const loadSlaSettings = async (reader: Reader): Promise<SlaSettings> => {
  const row = await reader.orm.public.CompanySettings.upsert({
    conflictOn: { id: "company" },
    create: { id: "company" },
    update: {},
  });
  return toSlaSettings(row);
};

export class SlaSettingsManagement extends Context.Service<
  SlaSettingsManagement,
  {
    readonly get: (
      actorId: string
    ) => Effect.Effect<SlaSettingsValues, AppError>;
    readonly update: (
      actorId: string,
      input: SlaSettingsInput
    ) => Effect.Effect<SlaSettingsValues, AppError>;
  }
>()("metsys/server/SlaSettingsManagement") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "SLA settings could not be loaded or saved.",
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

const validate = (input: SlaSettingsInput): void => {
  if (input.businessStartMinute >= input.businessEndMinute) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Business hours must end after they start.",
    });
  }
  for (const key of ImpactKeys) {
    const target = input.slaTargets[key];
    if (target.resolutionMinutes < target.firstResponseMinutes) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: `For ${key} impact, the resolution target cannot be shorter than the first response target.`,
      });
    }
  }
};

export const SlaSettingsManagementLive = Layer.succeed(
  SlaSettingsManagement,
  SlaSettingsManagement.of({
    get: (actorId) =>
      Effect.tryPromise({
        catch: mapError,
        try: async () => {
          await requireAdmin(actorId);
          const row = await db.orm.public.CompanySettings.upsert({
            conflictOn: { id: "company" },
            create: { id: "company" },
            update: {},
          });
          return toSlaSettingsValues(row);
        },
      }),
    update: (actorId, input) =>
      Effect.tryPromise({
        catch: mapError,
        try: async () => {
          await requireAdmin(actorId);
          validate(input);
          return db.transaction(async (transaction) => {
            await transaction.orm.public.CompanySettings.upsert({
              conflictOn: { id: "company" },
              create: { id: "company" },
              update: {},
            });
            const days = [...new Set(input.businessDays)].toSorted(
              (day, otherDay) => day - otherDay
            );
            const updated = await transaction.orm.public.CompanySettings.where({
              id: "company",
            }).update({
              businessDays: days,
              businessEndMinute: input.businessEndMinute,
              businessStartMinute: input.businessStartMinute,
              businessTimeZone: input.businessTimeZone,
              slaTargets: input.slaTargets,
              updatedAt: new Date(),
            });
            if (!updated) {
              throw new AppError({
                code: "UNAVAILABLE",
                message: "SLA settings could not be saved.",
              });
            }
            await transaction.orm.public.Activity.create({
              action: "company.sla_settings.updated",
              actorId,
              createdAt: new Date(),
              details: {
                businessDays: days,
                businessEndMinute: input.businessEndMinute,
                businessStartMinute: input.businessStartMinute,
              },
              id: crypto.randomUUID(),
              projectId: null,
              taskId: null,
            });
            return toSlaSettingsValues(updated);
          });
        },
      }),
  })
);

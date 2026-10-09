import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

const supportedTimezones = new Set([
  ...Intl.supportedValuesOf("timeZone"),
  "UTC",
  "Asia/Calcutta",
]);
const slugCharacters = "abcdefghijklmnopqrstuvwxyz0123456789-";
const hexCharacters = "0123456789abcdef";

const isSlug = (value: string): boolean =>
  value.length >= 3 &&
  value.length <= 48 &&
  value[0] !== "-" &&
  value.at(-1) !== "-" &&
  [...value].every((character) => slugCharacters.includes(character));

const isBrandColor = (value: string): boolean =>
  value.length === 7 &&
  value[0] === "#" &&
  [...value.slice(1).toLowerCase()].every((character) =>
    hexCharacters.includes(character)
  );

export const CompanySettingsInputSchema = Schema.Struct({
  brandColor: Schema.String.check(
    Schema.makeFilter((value) =>
      isBrandColor(value) ? undefined : "Enter a six-digit hexadecimal color."
    )
  ),
  brandEnabled: Schema.Boolean,
  name: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(100)),
  slug: Schema.String.check(
    Schema.makeFilter((value) =>
      isSlug(value) ? undefined : "Enter a valid company slug."
    )
  ),
  timeZone: Schema.String.check(
    Schema.makeFilter((timeZone) =>
      supportedTimezones.has(timeZone)
        ? undefined
        : "Choose a supported time zone."
    )
  ),
});

export type CompanySettingsInput = typeof CompanySettingsInputSchema.Type;

export interface CompanySettingsValues {
  readonly brandColor: string;
  readonly brandEnabled: boolean;
  readonly name: string;
  readonly slug: string;
  readonly timeZone: string;
}

export const CompanySettingsValuesSchema = Schema.Struct({
  brandColor: Schema.String,
  brandEnabled: Schema.Boolean,
  name: Schema.String,
  slug: Schema.String,
  timeZone: Schema.String,
});

export class CompanySettingsManagement extends Context.Service<
  CompanySettingsManagement,
  {
    readonly get: (
      actorId: string
    ) => Effect.Effect<CompanySettingsValues, AppError>;
    readonly update: (
      actorId: string,
      input: CompanySettingsInput
    ) => Effect.Effect<CompanySettingsValues, AppError>;
  }
>()("metsys/server/CompanySettingsManagement") {}

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Company settings could not be loaded or saved.",
      });

const getActor = async (actorId: string, adminOnly: boolean): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("role", "deactivatedAt", "mustChangePassword")
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
  if (adminOnly && actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Administrator access is required.",
    });
  }
};

const ensureCompanySettings = () =>
  db.orm.public.CompanySettings.upsert({
    conflictOn: { id: "company" },
    create: { id: "company" },
    update: {},
  });

const toValues = (
  settings: Awaited<ReturnType<typeof ensureCompanySettings>>
) => ({
  brandColor: settings.brandColor,
  brandEnabled: settings.brandEnabled,
  name: settings.name,
  slug: settings.slug,
  timeZone: settings.timeZone,
});

export const CompanySettingsManagementLive = Layer.succeed(
  CompanySettingsManagement,
  CompanySettingsManagement.of({
    get: (actorId) =>
      Effect.tryPromise({
        catch: mapError,
        try: async () => {
          await getActor(actorId, false);
          return toValues(await ensureCompanySettings());
        },
      }),
    update: (actorId, input) =>
      Effect.tryPromise({
        catch: mapError,
        try: async () => {
          await getActor(actorId, true);
          return db.transaction(async (transaction) => {
            const current = await transaction.orm.public.CompanySettings.upsert(
              {
                conflictOn: { id: "company" },
                create: { id: "company" },
                update: {},
              }
            );
            const updated = await transaction.orm.public.CompanySettings.where({
              id: current.id,
            }).update({
              brandColor: input.brandColor.toLowerCase(),
              brandEnabled: input.brandEnabled,
              name: input.name.trim(),
              slug: input.slug,
              timeZone: input.timeZone,
              updatedAt: new Date(),
            });
            if (!updated) {
              throw new AppError({
                code: "UNAVAILABLE",
                message: "Company settings could not be saved.",
              });
            }
            await transaction.orm.public.Activity.create({
              action: "company.settings.updated",
              actorId,
              createdAt: new Date(),
              details: {
                name: input.name.trim(),
                slug: input.slug,
                timeZone: input.timeZone,
              },
              id: crypto.randomUUID(),
              projectId: null,
              taskId: null,
            });
            return toValues(updated);
          });
        },
      }),
  })
);

import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import { Context, Effect, Layer, Schema } from "effect";

import type { CodecTypes, Models } from "@/src/prisma/contract.d";
import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

const supportedTimezones = new Set([
  ...Intl.supportedValuesOf("timeZone"),
  "UTC",
  "Asia/Calcutta",
]);

export const PersonalPreferenceSchema = Schema.Struct({
  calendarView: Schema.optional(Schema.Literals(["day", "week", "month"])),
  defaultViewId: Schema.optional(
    Schema.NullOr(Schema.String.check(Schema.isUUID()))
  ),
  density: Schema.optional(Schema.Literals(["comfortable", "compact"])),
  timezone: Schema.optional(
    Schema.String.check(
      Schema.makeFilter((timezone) =>
        supportedTimezones.has(timezone)
          ? undefined
          : "Choose a supported time zone."
      )
    )
  ),
}).check(
  Schema.makeFilter((preferences) =>
    Buffer.byteLength(JSON.stringify(preferences), "utf-8") <= 4096
      ? undefined
      : "Preference settings are too large."
  )
);

export type PersonalPreferenceValues = typeof PersonalPreferenceSchema.Type;
export type UserPreferenceModel = Models.public_UserPreference;
export type UserPreferenceScalars = Scalars<UserPreferenceModel>;

const preferenceKey = "display";

const validationError = () =>
  new AppError({
    code: "VALIDATION_FAILED",
    message: "The preference settings are invalid.",
  });

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "The preferences could not be loaded or saved.",
      });

const validateValues = (input: unknown) =>
  Schema.decodeUnknownEffect(PersonalPreferenceSchema)(input).pipe(
    Effect.mapError(() => validationError())
  );

const getPreferenceQuery = (userId: string) =>
  db.orm.public.UserPreference.where({
    key: preferenceKey,
    userId,
  })
    .select("value")
    .first();

type PreferenceQueryResult = Awaited<ReturnType<typeof getPreferenceQuery>>;

const toJsonValue = (
  values: PersonalPreferenceValues
): CodecTypes["pg/jsonb@1"]["input"] => ({
  ...(values.calendarView === undefined
    ? {}
    : { calendarView: values.calendarView }),
  ...(values.density === undefined ? {} : { density: values.density }),
  ...(values.defaultViewId === undefined
    ? {}
    : { defaultViewId: values.defaultViewId }),
  ...(values.timezone === undefined ? {} : { timezone: values.timezone }),
});

export class PersonalPreferences extends Context.Service<
  PersonalPreferences,
  {
    readonly get: (
      userId: string
    ) => Effect.Effect<PersonalPreferenceValues, AppError>;
    readonly save: (
      userId: string,
      values: unknown
    ) => Effect.Effect<PersonalPreferenceValues, AppError>;
  }
>()("metsys/server/PersonalPreferences") {}

export const PersonalPreferencesLive = Layer.succeed(PersonalPreferences, {
  get: (userId) =>
    Effect.tryPromise({
      catch: mapError,
      try: () => getPreferenceQuery(userId),
    }).pipe(
      Effect.flatMap((record: PreferenceQueryResult) =>
        Schema.decodeUnknownEffect(PersonalPreferenceSchema)(
          record?.value ?? {}
        ).pipe(Effect.mapError(() => validationError()))
      )
    ),
  save: (userId, rawValues) =>
    validateValues(rawValues).pipe(
      Effect.flatMap((values) =>
        Effect.tryPromise({
          catch: mapError,
          try: async () => {
            const viewId = values.defaultViewId;
            if (viewId) {
              const view = await db.orm.public.SavedView.first({ id: viewId });
              if (!view || (view.userId !== userId && !view.isShared)) {
                throw new AppError({
                  code: "NOT_FOUND",
                  message: "The default saved view was not found.",
                });
              }
            }
            await db.orm.public.UserPreference.upsert({
              conflictOn: { key: preferenceKey, userId },
              create: {
                key: preferenceKey,
                userId,
                value: toJsonValue(values),
              },
              update: { updatedAt: new Date(), value: toJsonValue(values) },
            });
            return values;
          },
        })
      )
    ),
});

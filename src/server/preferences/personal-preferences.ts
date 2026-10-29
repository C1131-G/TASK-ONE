import type { Scalars } from "@prisma/orm-postgres/family-contract/types";
import { Context, Effect, Layer, Schema } from "effect";

import type { CodecTypes, Models } from "@/src/prisma/contract.d";
import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";

const supportedTimezones = new Set([
  ...Intl.supportedValuesOf("timeZone"),
  "UTC",
  // Node's ICU lists only the legacy Calcutta ID, but the forms default to Kolkata.
  "Asia/Kolkata",
  "Asia/Calcutta",
]);

const MAX_COLUMN_WIDTH_ENTRIES = 32;

// Widths are per column ID (task table columns). The UI clamps to the same bounds.
export const TaskTableColumnWidthsSchema = Schema.Record(
  Schema.String.check(Schema.isMaxLength(40)),
  Schema.Int.check(Schema.isBetween({ maximum: 800, minimum: 80 }))
).check(
  Schema.makeFilter((widths) =>
    Object.keys(widths).length <= MAX_COLUMN_WIDTH_ENTRIES
      ? undefined
      : "Too many column widths."
  )
);

export const PersonalPreferenceSchema = Schema.Struct({
  calendarView: Schema.optional(Schema.Literals(["day", "week", "month"])),
  defaultViewId: Schema.optional(
    Schema.NullOr(Schema.String.check(Schema.isUUID()))
  ),
  density: Schema.optional(Schema.Literals(["comfortable", "compact"])),
  taskTableColumnWidths: Schema.optional(TaskTableColumnWidthsSchema),
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
  ...(values.taskTableColumnWidths === undefined
    ? {}
    : { taskTableColumnWidths: values.taskTableColumnWidths }),
  ...(values.timezone === undefined ? {} : { timezone: values.timezone }),
});

const readValues = (
  userId: string
): Effect.Effect<PersonalPreferenceValues, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => getPreferenceQuery(userId),
  }).pipe(
    Effect.flatMap((record: PreferenceQueryResult) =>
      Schema.decodeUnknownEffect(PersonalPreferenceSchema)(
        record?.value ?? {}
      ).pipe(Effect.mapError(() => validationError()))
    )
  );

const writeValues = (
  userId: string,
  values: PersonalPreferenceValues
): Effect.Effect<PersonalPreferenceValues, AppError> =>
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
  });

// A display save only sends the fields it owns. Column widths are saved on their
// own, so an absent width map keeps whatever is already stored.
const saveValues = (
  userId: string,
  rawValues: unknown
): Effect.Effect<PersonalPreferenceValues, AppError> =>
  validateValues(rawValues).pipe(
    Effect.flatMap((values) =>
      values.taskTableColumnWidths === undefined
        ? readValues(userId).pipe(
            // An absent key, not an undefined one, keeps the saved result schema-valid.
            Effect.map((current) =>
              current.taskTableColumnWidths === undefined
                ? values
                : {
                    ...values,
                    taskTableColumnWidths: current.taskTableColumnWidths,
                  }
            )
          )
        : Effect.succeed(values)
    ),
    Effect.flatMap((values) => writeValues(userId, values))
  );

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
    readonly saveColumnWidths: (
      userId: string,
      widths: unknown
    ) => Effect.Effect<PersonalPreferenceValues, AppError>;
  }
>()("taskora/server/PersonalPreferences") {}

export const PersonalPreferencesLive = Layer.succeed(PersonalPreferences, {
  get: readValues,
  save: saveValues,
  saveColumnWidths: (userId, widths) =>
    readValues(userId).pipe(
      Effect.flatMap((current) =>
        saveValues(userId, { ...current, taskTableColumnWidths: widths })
      )
    ),
});

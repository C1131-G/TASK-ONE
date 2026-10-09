import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { LabelColorSchema } from "../core/input-schemas";

export interface LabelInput {
  readonly color: string;
  readonly name: string;
}

export interface LabelSummary extends LabelInput {
  readonly id: string;
  readonly createdAt: string;
}

export const LabelSummarySchema = Schema.Struct({
  color: Schema.String,
  createdAt: Schema.String,
  id: Schema.String,
  name: Schema.String,
});

const validate = (input: LabelInput): LabelInput => {
  const name = input.name.trim();
  const color = input.color.trim().toLowerCase();
  if (!name || name.length > 50 || !Schema.is(LabelColorSchema)(color)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Provide a short label name and a valid color.",
    });
  }
  return { color, name };
};

const requireActor = async (userId: string): Promise<string> => {
  const account = await db.orm.public.User.where({ id: userId })
    .select("role", "deactivatedAt", "mustChangePassword")
    .first();
  if (!account || account.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (account.mustChangePassword) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Change your password before continuing.",
    });
  }
  return account.role;
};

const requireAdmin = async (userId: string): Promise<void> => {
  const role = await requireActor(userId);
  if (role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Only administrators can manage labels.",
    });
  }
};

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "Labels could not be updated.",
      });

export class LabelManagement extends Context.Service<
  LabelManagement,
  {
    readonly list: (
      userId: string
    ) => Effect.Effect<readonly LabelSummary[], AppError>;
    readonly create: (
      userId: string,
      input: LabelInput
    ) => Effect.Effect<LabelSummary, AppError>;
    readonly update: (
      userId: string,
      labelId: string,
      input: LabelInput
    ) => Effect.Effect<LabelSummary, AppError>;
    readonly remove: (
      userId: string,
      labelId: string
    ) => Effect.Effect<void, AppError>;
  }
>()("metsys/server/LabelManagement") {}

const labelSummary = (label: {
  readonly color: string;
  readonly createdAt: Date;
  readonly id: string;
  readonly name: string;
}): LabelSummary => ({
  color: label.color,
  createdAt: label.createdAt.toISOString(),
  id: label.id,
  name: label.name,
});

export const LabelManagementLive = Layer.succeed(LabelManagement, {
  create: (userId, rawInput) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const input = validate(rawInput);
        await requireAdmin(userId);
        return db.transaction(async (transaction) => {
          const labels = await transaction.orm.public.Label.select(
            "id",
            "name"
          ).all();
          if (
            labels.some(
              (label) => label.name.toLowerCase() === input.name.toLowerCase()
            )
          ) {
            throw new AppError({
              code: "CONFLICT",
              message: "A label with that name already exists.",
            });
          }
          const created = await transaction.orm.public.Label.create({
            color: input.color,
            id: crypto.randomUUID(),
            name: input.name,
          });
          return labelSummary(created);
        });
      },
    }),
  list: (userId) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        await requireActor(userId);
        const labels = await db.orm.public.Label.orderBy((label) =>
          label.name.asc()
        ).all();
        return labels.map(labelSummary);
      },
    }),
  remove: (userId, labelId) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        await requireAdmin(userId);
        const removed = await db.orm.public.Label.where({
          id: labelId,
        }).delete();
        if (!removed) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The label was not found.",
          });
        }
      },
    }),
  update: (userId, labelId, rawInput) =>
    Effect.tryPromise({
      catch: mapError,
      try: async () => {
        const input = validate(rawInput);
        await requireAdmin(userId);
        return db.transaction(async (transaction) => {
          const labels = await transaction.orm.public.Label.select(
            "id",
            "name"
          ).all();
          if (
            labels.some(
              (label) =>
                label.id !== labelId &&
                label.name.toLowerCase() === input.name.toLowerCase()
            )
          ) {
            throw new AppError({
              code: "CONFLICT",
              message: "A label with that name already exists.",
            });
          }
          const updated = await transaction.orm.public.Label.where({
            id: labelId,
          }).update(input);
          if (!updated) {
            throw new AppError({
              code: "NOT_FOUND",
              message: "The label was not found.",
            });
          }
          return labelSummary(updated);
        });
      },
    }),
});

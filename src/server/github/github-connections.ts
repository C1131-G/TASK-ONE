import { randomUUID } from "node:crypto";

import { Context, Effect, Layer } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import { requireAdmin } from "../webhooks/webhook-internal";
import {
  encryptSecret,
  generateSecret,
  secretHint,
  webhookKeyMaterial,
} from "../webhooks/webhook-secret";
import type {
  GithubConnectionChanges,
  GithubConnectionCreated,
  GithubConnectionInput,
  GithubConnectionSummary,
} from "./github-contracts";
import { isRepoFullName, normalizeRepoFullName } from "./github-contracts";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const mapError = (error: unknown): AppError =>
  error instanceof AppError
    ? error
    : new AppError({
        code: "UNAVAILABLE",
        message: "GitHub connections could not be loaded or saved.",
      });

const notFound = (): AppError =>
  new AppError({
    code: "NOT_FOUND",
    message: "That GitHub connection was not found.",
  });

const invalid = (field: string, message: string): AppError =>
  new AppError({ code: "VALIDATION_FAILED", field, message });

const recordActivity = (
  transaction: Transaction,
  actorId: string,
  action: string,
  connectionId: string,
  now: Date
) =>
  transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: now,
    details: { connectionId },
    id: randomUUID(),
    projectId: null,
    taskId: null,
  });

const sealedSecret = () => {
  const secret = generateSecret();
  return {
    secret,
    stored: {
      secretCiphertext: encryptSecret(secret, webhookKeyMaterial()),
      secretHint: secretHint(secret),
    },
  };
};

interface ConnectionRow {
  readonly id: string;
  readonly repoFullName: string;
  readonly projectId: string;
  readonly enabled: boolean;
  readonly autoCompleteOnMerge: boolean;
  readonly secretHint: string;
  readonly createdAt: Date;
}

const toSummary = (
  row: ConnectionRow,
  project: { readonly key: string; readonly name: string } | null | undefined
): GithubConnectionSummary => ({
  autoCompleteOnMerge: row.autoCompleteOnMerge,
  createdAt: row.createdAt.toISOString(),
  enabled: row.enabled,
  id: row.id,
  projectId: row.projectId,
  projectKey: project?.key ?? "",
  projectName: project?.name ?? "Unknown project",
  repoFullName: row.repoFullName,
  secretHint: row.secretHint,
});

const projectOf = (transaction: Transaction, projectId: string) =>
  transaction.orm.public.Project.where({ id: projectId })
    .select("key", "name", "archivedAt")
    .first();

const list = async (
  actorId: string
): Promise<readonly GithubConnectionSummary[]> => {
  await requireAdmin(actorId);
  const [rows, projects] = await Promise.all([
    db.orm.public.GithubConnection.orderBy((connection) =>
      connection.createdAt.desc()
    ).all(),
    db.orm.public.Project.select("id", "key", "name").all(),
  ]);
  const byId = new Map(projects.map((project) => [project.id, project]));
  return rows.map((row) => toSummary(row, byId.get(row.projectId)));
};

const create = async (
  actorId: string,
  input: GithubConnectionInput
): Promise<GithubConnectionCreated> => {
  await requireAdmin(actorId);
  if (!isRepoFullName(input.repoFullName)) {
    throw invalid(
      "repoFullName",
      "Enter the repository as owner/name, for example acme/web."
    );
  }
  const repoFullName = normalizeRepoFullName(input.repoFullName);
  const sealed = sealedSecret();
  const now = new Date();
  try {
    return await db.transaction(async (transaction) => {
      const project = await projectOf(transaction, input.projectId);
      if (!project || project.archivedAt) {
        throw invalid("projectId", "Choose an active project.");
      }
      const existing = await transaction.orm.public.GithubConnection.where({
        repoFullName,
      })
        .select("id")
        .first();
      if (existing) {
        throw new AppError({
          code: "CONFLICT",
          field: "repoFullName",
          message: "That repository is already connected.",
        });
      }
      const row = await transaction.orm.public.GithubConnection.create({
        autoCompleteOnMerge: input.autoCompleteOnMerge,
        createdAt: now,
        createdById: actorId,
        enabled: true,
        id: randomUUID(),
        projectId: input.projectId,
        repoFullName,
        secretCiphertext: sealed.stored.secretCiphertext,
        secretHint: sealed.stored.secretHint,
        updatedAt: now,
      });
      await recordActivity(
        transaction,
        actorId,
        "github.connected",
        row.id,
        now
      );
      return { connection: toSummary(row, project), secret: sealed.secret };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new AppError({
        code: "CONFLICT",
        field: "repoFullName",
        message: "That repository is already connected.",
      });
    }
    throw error;
  }
};

const update = async (
  actorId: string,
  connectionId: string,
  changes: GithubConnectionChanges
): Promise<GithubConnectionSummary> => {
  await requireAdmin(actorId);
  return await db.transaction(async (transaction) => {
    const now = new Date();
    const row = await transaction.orm.public.GithubConnection.where({
      id: connectionId,
    }).update({
      autoCompleteOnMerge: changes.autoCompleteOnMerge,
      enabled: changes.enabled,
      updatedAt: now,
    });
    if (!row) {
      throw notFound();
    }
    await recordActivity(transaction, actorId, "github.updated", row.id, now);
    return toSummary(row, await projectOf(transaction, row.projectId));
  });
};

const rotateSecret = async (
  actorId: string,
  connectionId: string
): Promise<{ readonly secret: string }> => {
  await requireAdmin(actorId);
  return await db.transaction(async (transaction) => {
    const { secret, stored } = sealedSecret();
    const now = new Date();
    const row = await transaction.orm.public.GithubConnection.where({
      id: connectionId,
    }).update({ ...stored, updatedAt: now });
    if (!row) {
      throw notFound();
    }
    await recordActivity(
      transaction,
      actorId,
      "github.secret_rotated",
      row.id,
      now
    );
    return { secret };
  });
};

export class GithubConnections extends Context.Service<
  GithubConnections,
  {
    readonly list: (
      actorId: string
    ) => Effect.Effect<readonly GithubConnectionSummary[], AppError>;
    readonly create: (
      actorId: string,
      input: GithubConnectionInput
    ) => Effect.Effect<GithubConnectionCreated, AppError>;
    readonly update: (
      actorId: string,
      connectionId: string,
      changes: GithubConnectionChanges
    ) => Effect.Effect<GithubConnectionSummary, AppError>;
    readonly rotateSecret: (
      actorId: string,
      connectionId: string
    ) => Effect.Effect<{ readonly secret: string }, AppError>;
  }
>()("taskora/server/GithubConnections") {}

const attempt = <Value>(run: () => Promise<Value>) =>
  Effect.tryPromise({ catch: mapError, try: run });

export const GithubConnectionsLive = Layer.succeed(
  GithubConnections,
  GithubConnections.of({
    create: (actorId, input) => attempt(() => create(actorId, input)),
    list: (actorId) => attempt(() => list(actorId)),
    rotateSecret: (actorId, connectionId) =>
      attempt(() => rotateSecret(actorId, connectionId)),
    update: (actorId, connectionId, changes) =>
      attempt(() => update(actorId, connectionId, changes)),
  })
);

import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { UUIDSchema } from "../core/input-schemas";
import type { LinkedPull } from "./github-contracts";
import { PULL_STATES } from "./github-contracts";

const MAX_LINKED_PULLS = 50;
const isUuid = Schema.is(UUIDSchema);

const stateOf = (value: string): LinkedPull["state"] =>
  PULL_STATES.find((state) => state === value) ?? "open";

// Pull requests are internal engineering detail, so clients never read them.
const requireStaff = async (actorId: string): Promise<void> => {
  const actor = await db.orm.public.User.where({ id: actorId })
    .select("deactivatedAt", "mustChangePassword", "role")
    .first();
  if (!actor || actor.deactivatedAt || actor.role === "client") {
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
};

const forTask = async (
  actorId: string,
  taskId: string
): Promise<readonly LinkedPull[]> => {
  await requireStaff(actorId);
  const notFound = new AppError({
    code: "NOT_FOUND",
    message: "The task was not found.",
  });
  if (!isUuid(taskId)) {
    throw notFound;
  }
  const task = await db.orm.public.Task.where({ id: taskId })
    .select("id")
    .first();
  if (!task) {
    throw notFound;
  }
  const [links, connections] = await Promise.all([
    db.orm.public.GithubPullLink.where({ taskId })
      .orderBy((link) => link.updatedAt.desc())
      .limit(MAX_LINKED_PULLS)
      .all(),
    db.orm.public.GithubConnection.select("id", "repoFullName").all(),
  ]);
  const repositories = new Map(
    connections.map(({ id, repoFullName }) => [id, repoFullName])
  );
  return links.map((link) => ({
    authorLogin: link.authorLogin,
    id: link.id,
    number: link.prNumber,
    repoFullName: repositories.get(link.connectionId) ?? "",
    state: stateOf(link.state),
    title: link.title,
    updatedAt: link.updatedAt.toISOString(),
    url: link.url,
  }));
};

export class GithubPulls extends Context.Service<
  GithubPulls,
  {
    readonly forTask: (
      actorId: string,
      taskId: string
    ) => Effect.Effect<readonly LinkedPull[], AppError>;
  }
>()("taskora/server/GithubPulls") {}

export const GithubPullsLive = Layer.succeed(
  GithubPulls,
  GithubPulls.of({
    forTask: (actorId, taskId) =>
      Effect.tryPromise({
        catch: (error) =>
          error instanceof AppError
            ? error
            : new AppError({
                code: "UNAVAILABLE",
                message: "Linked pull requests could not be loaded.",
              }),
        try: () => forTask(actorId, taskId),
      }),
  })
);

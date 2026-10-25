import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { TASK_FIXTURES } from "@/api/mocks/tasks";
import { makeMockMobileApiLayer } from "@/api/mock/mock-fetch";
import { MobileApi, TokenSource } from "@/services/mobile-api";
import { makeIdempotencyKeys, IdempotencyKeys } from "@/services/idempotency-keys";
import {
  createTask,
  getTask,
  listSubtasks,
  listTasks,
  setSubtaskStatus,
  setTaskStatus,
} from "@/features/tasks/queries";

const tokenSource = Layer.succeed(
  TokenSource,
  TokenSource.of({ currentToken: Effect.succeed("token-1"), onUnauthenticated: Effect.void }),
);

const mockApi = (fixtures = TASK_FIXTURES) =>
  Effect.map(makeMockMobileApiLayer(fixtures, new Set(["tasks"])), (apiLayer) => {
    const deps = Layer.mergeAll(tokenSource, makeIdempotencyKeys());
    return Layer.mergeAll(Layer.provide(apiLayer, deps), deps);
  });

const withApi = <A>(program: Effect.Effect<A, unknown, MobileApi | IdempotencyKeys>) =>
  Effect.flatMap(mockApi(), (layer) => program.pipe(Effect.provide(layer)));

it.effect("lists tasks through the typed queries", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);

      const page = yield* listTasks(api);

      expect(page.tasks.length).toBe(3);
      expect(page.tasks[0]?.title).toBe("Ship the landing page");
    }),
  ),
);

it.effect("reads one task's detail", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);

      const detail = yield* getTask(api, "task-1");

      expect(detail.subtasks.length).toBe(2);
      expect(detail.labels).toEqual(["design", "launch"]);
    }),
  ),
);

it.effect("creates a task under an idempotency key", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const created = yield* keys.run("new-task", (key) =>
        createTask(api, key, {
          priority: "high",
          projectId: "proj-1",
          title: "New from mobile",
        }),
      );

      expect(created.number).toBe(14);
    }),
  ),
);

it.effect("moves a task status with the optimistic version", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const moved = yield* keys.run("move-task-1", (key) =>
        setTaskStatus(api, key, "task-1", 3, "done"),
      );

      expect(moved.version).toBe(4);
    }),
  ),
);

it.effect("toggles a subtask", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const subtasks = yield* listSubtasks(api, "task-1");
      const target = subtasks.subtasks[1]!;

      const toggled = yield* keys.run(`sub-${target.id}`, (key) =>
        setSubtaskStatus(api, key, "task-1", target.id, 3, !target.done),
      );

      expect(toggled.done).toBe(true);
    }),
  ),
);

import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { TASK_FIXTURES, TASKS } from "@/api/mocks/tasks";
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

      const detail = yield* getTask(api, TASKS[0]!.id);

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
          assigneeIds: [],
          priority: "high",
          projectId: TASKS[0]!.projectId,
          title: "New from mobile",
        }),
      );

      expect(created.reference).toBe("WEB-14");
    }),
  ),
);

it.effect("moves a task status with the optimistic version", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const moved = yield* keys.run("move-task-1", (key) =>
        setTaskStatus(api, key, TASKS[0]!.id, 3, "done"),
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

      const subtasks = yield* listSubtasks(api, TASKS[0]!.id);
      const target = subtasks.subtasks[1]!;

      const toggled = yield* keys.run(`sub-${target.id}`, (key) =>
        setSubtaskStatus(api, key, TASKS[0]!.id, target.id, 3, !target.done),
      );

      expect(toggled.done).toBe(true);
    }),
  ),
);

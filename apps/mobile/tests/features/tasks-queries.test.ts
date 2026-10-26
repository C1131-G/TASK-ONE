import { it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { expect } from "vitest";

import { TASK_FIXTURES, TASK_IDS } from "@/api/mocks/tasks";
import { makeMockMobileApiLayer } from "@/api/mock/mock-fetch";
import { MobileApi, TokenSource } from "@/services/mobile-api";
import { makeIdempotencyKeys, IdempotencyKeys } from "@/services/idempotency-keys";
import {
  changeTask,
  createTask,
  getMyWork,
  getTaskContext,
  listTasks,
  setSubtaskStatus,
} from "@/features/tasks/queries";

const tokenSource = Layer.succeed(
  TokenSource,
  TokenSource.of({ currentToken: Effect.succeed("token-1"), onUnauthenticated: Effect.void }),
);

const mockApi = (fixtures = TASK_FIXTURES) =>
  Effect.map(makeMockMobileApiLayer(fixtures, new Set(["tasks", "me"])), (apiLayer) => {
    const deps = Layer.mergeAll(tokenSource, makeIdempotencyKeys());
    return Layer.mergeAll(Layer.provide(apiLayer, deps), deps);
  });

const withApi = <A>(program: Effect.Effect<A, unknown, MobileApi | IdempotencyKeys>) =>
  Effect.flatMap(mockApi(), (layer) => program.pipe(Effect.provide(layer)));

it.effect("reads the caller's open work", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);

      const work = yield* getMyWork(api);

      expect(work.items.map((item) => item.reference)).toEqual(["WEB-12", "WEB-13"]);
      expect(work.nextOffset).toBeNull();
    }),
  ),
);

it.effect("narrows the open work to one scope", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);

      const work = yield* getMyWork(api, "overdue");

      expect(work.items.length).toBeGreaterThan(0);
    }),
  ),
);

it.effect("reads one task with its subtasks and permitted actions", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);

      const context = yield* getTaskContext(api, TASK_IDS.one);

      expect(context.subtasks.map((subtask) => subtask.title)).toEqual([
        "Hero art",
        "Launch checklist",
      ]);
      expect(context.permittedActions).toContain("update");
    }),
  ),
);

it.effect("changes a task under an idempotency key and the version the caller saw", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const moved = yield* keys.run("move-task-1", (key) =>
        changeTask(api, key, TASK_IDS.one, { expectedVersion: 3, status: "done" }),
      );

      expect(moved.status).toBe("done");
      expect(moved.version).toBe(4);
    }),
  ),
);

it.effect("creates a task and assigns it", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const created = yield* keys.run("new-task", (key) =>
        createTask(api, key, {
          assigneeIds: [],
          priority: "high",
          projectId: "5a1d9c42-6b7e-4f30-8c2d-9e4b1a7f3c05",
          title: "New from mobile",
        }),
      );

      expect(created.reference).toBe("WEB-14");
    }),
  ),
);

it.effect("lists every workspace task while that route is pending", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);

      const page = yield* listTasks(api);

      expect(page.tasks.length).toBe(3);
      expect(page.tasks[0]?.title).toBe("Ship the landing page");
    }),
  ),
);

it.effect("toggles a subtask while that route is pending", () =>
  withApi(
    Effect.gen(function* () {
      const api = yield* Effect.service(MobileApi);
      const keys = yield* Effect.service(IdempotencyKeys);

      const toggled = yield* keys.run("sub-toggle", (key) =>
        setSubtaskStatus(api, key, TASK_IDS.one, "sub-2", 3, true),
      );

      expect(toggled.done).toBe(true);
    }),
  ),
);
